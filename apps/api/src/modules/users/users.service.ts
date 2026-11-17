import { Injectable } from '@nestjs/common';
import type { CapabilityRole, CurrentUser } from '@musicverse/types';
import type {
  DeleteAccountInput,
  UpdatePreferencesInput,
  UpdateProfileInput,
} from '@musicverse/validation';
import { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/http/request-meta';
import { MailService } from '../../infrastructure/mail/mail.service';
import { accountDeletionEmail } from '../../infrastructure/mail/templates';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthzCacheService } from '../auth/services/authz-cache.service';
import { PasswordService } from '../auth/services/password.service';
import { RolesService } from '../auth/services/roles.service';
import { SessionService } from '../auth/services/session.service';
import { loadCurrentUser, normalisePreferences } from './current-user';

export const DELETION_GRACE_DAYS = 30;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly authz: AuthzCacheService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  me(userId: string): Promise<CurrentUser> {
    return loadCurrentUser(this.prisma, userId);
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
    meta: RequestMeta,
  ): Promise<CurrentUser> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.userProfile.update({ where: { userId }, data: input });
        await this.audit.record(
          {
            action: 'user.profile.updated',
            actorId: userId,
            targetType: 'user',
            targetId: userId,
            metadata: { fields: Object.keys(input) },
          },
          meta,
          tx,
        );
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.conflict('USERNAME_TAKEN', 'That username is already taken.');
      }
      throw error;
    }
    return this.me(userId);
  }

  async updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<CurrentUser> {
    const profile = await this.prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    const current = normalisePreferences(profile.preferences);
    const next = {
      ...current,
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.explicitContent !== undefined ? { explicitContent: input.explicitContent } : {}),
      emailNotifications: { ...current.emailNotifications, ...(input.emailNotifications ?? {}) },
    };
    await this.prisma.userProfile.update({ where: { userId }, data: { preferences: next } });
    return this.me(userId);
  }

  /**
   * Add a self-service capability role (artist, producer, dj, business, educator). Creator
   * capabilities unlock uploads and payouts later, so a verified email is required.
   */
  async addCapability(
    userId: string,
    role: CapabilityRole,
    meta: RequestMeta,
  ): Promise<CurrentUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.emailVerifiedAt) {
      throw AppError.forbidden(
        'Verify your email address before adding creator capabilities.',
        'EMAIL_NOT_VERIFIED',
      );
    }
    const roleId = await this.roles.idFor(role);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userRole.findUnique({
        where: { userId_roleId: { userId, roleId } },
      });
      if (existing) return;
      await tx.userRole.create({ data: { userId, roleId, grantedById: userId } });
      await this.audit.record(
        {
          action: 'user.capability.added',
          actorId: userId,
          targetType: 'user',
          targetId: userId,
          metadata: { role },
        },
        meta,
        tx,
      );
    });
    await this.authz.invalidateUser(userId);
    return this.me(userId);
  }

  async removeCapability(
    userId: string,
    role: CapabilityRole,
    meta: RequestMeta,
  ): Promise<CurrentUser> {
    const roleId = await this.roles.idFor(role);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.userRole.deleteMany({ where: { userId, roleId } });
      if (count > 0) {
        await this.audit.record(
          {
            action: 'user.capability.removed',
            actorId: userId,
            targetType: 'user',
            targetId: userId,
            metadata: { role },
          },
          meta,
          tx,
        );
      }
    });
    await this.authz.invalidateUser(userId);
    return this.me(userId);
  }

  /** Deactivate now; personal data is anonymised after the grace period by `purgeExpiredDeletions`. */
  async scheduleDeletion(
    userId: string,
    input: DeleteAccountInput,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    if (user.passwordHash) {
      if (!input.password || !(await this.passwords.verify(user.passwordHash, input.password))) {
        throw AppError.unauthorized('INVALID_CREDENTIALS', 'Your password is incorrect.');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: 'pending_deletion', deletedAt: new Date() },
      });
      await this.audit.record(
        {
          action: 'user.deletion.scheduled',
          actorId: userId,
          targetType: 'user',
          targetId: userId,
          metadata: { graceDays: DELETION_GRACE_DAYS },
        },
        meta,
        tx,
      );
    });
    await this.sessions.revokeAllForUser(userId, 'account_deleted');
    await this.authz.invalidateUser(userId);
    await this.mail.send({
      to: user.email,
      ...accountDeletionEmail(user.profile?.displayName ?? 'there'),
    });
  }

  /**
   * Anonymise accounts whose deletion grace period has elapsed. Run daily as a scheduled job
   * (`node dist/jobs/purge-deleted-accounts.js`). Rows are kept (with PII removed) so foreign keys
   * from audit/financial records remain valid.
   */
  async purgeExpiredDeletions(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - DELETION_GRACE_DAYS * 86_400_000);
    const due = await this.prisma.user.findMany({
      where: { status: 'pending_deletion', deletedAt: { lte: cutoff } },
      select: { id: true },
    });
    for (const { id } of due) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            email: `deleted+${id}@deleted.invalid`,
            passwordHash: null,
            emailVerifiedAt: null,
            status: 'deleted',
          },
        });
        await tx.userProfile.update({
          where: { userId: id },
          data: {
            displayName: 'Deleted user',
            username: null,
            avatarUrl: null,
            bio: null,
            countryCode: null,
            preferences: {},
          },
        });
        await tx.oAuthAccount.deleteMany({ where: { userId: id } });
        await tx.mfaFactor.deleteMany({ where: { userId: id } });
        await tx.verificationToken.deleteMany({ where: { userId: id } });
        await tx.session.deleteMany({ where: { userId: id } });
        await tx.userRole.deleteMany({ where: { userId: id } });
        await this.audit.record(
          { action: 'user.anonymised', targetType: 'user', targetId: id },
          {},
          tx,
        );
      });
    }
    return due.length;
  }
}
