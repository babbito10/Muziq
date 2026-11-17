import { Inject, Injectable, Logger } from '@nestjs/common';
import { isStaff } from '@musicverse/auth';
import type {
  AuthSuccessResponse,
  ClientType,
  LoginResponse,
  OAuthProvider,
  ProvidersResponse,
} from '@musicverse/types';
import type {
  ChangePasswordInput,
  LoginInput,
  OAuthSignInInput,
  RegisterInput,
  ResetPasswordInput,
} from '@musicverse/validation';
import { Prisma, type User } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/http/request-meta';
import { MailService } from '../../infrastructure/mail/mail.service';
import {
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
} from '../../infrastructure/mail/templates';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_PREFERENCES, loadCurrentUser } from '../users/current-user';
import { ID_TOKEN_VERIFIERS, type IdTokenVerifiers } from './providers/oauth-providers';
import { AuthzCacheService } from './services/authz-cache.service';
import { sha256Hex } from './services/crypto';
import { MfaService } from './services/mfa.service';
import { PasswordService } from './services/password.service';
import { RolesService } from './services/roles.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { VerificationTokenService } from './services/verification-token.service';

type Output<T> = T & { clientType: ClientType };

/** Result of a successful authentication; the controller decides cookie vs body delivery. */
export interface IssuedSession {
  response: AuthSuccessResponse;
  refreshToken: string;
  clientType: ClientType;
}

const INVALID_CREDENTIALS = () =>
  AppError.unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect.');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly verification: VerificationTokenService,
    private readonly mfa: MfaService,
    private readonly roles: RolesService,
    private readonly authz: AuthzCacheService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(ID_TOKEN_VERIFIERS) private readonly verifiers: IdTokenVerifiers,
  ) {}

  providers(): ProvidersResponse {
    return {
      password: true,
      google: this.verifiers.google.isConfigured(),
      apple: this.verifiers.apple.isConfigured(),
    };
  }

  // ------------------------------------------------------------------ registration & login

  async register(input: Output<RegisterInput>, meta: RequestMeta): Promise<IssuedSession> {
    if (input.clientType === 'admin') {
      throw AppError.forbidden('Administrator accounts cannot be created through registration.');
    }
    const passwordHash = await this.passwords.hash(input.password);
    const listenerRoleId = await this.roles.idFor('listener');

    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: input.email,
            passwordHash,
            profile: {
              create: { displayName: input.displayName, preferences: DEFAULT_PREFERENCES as never },
            },
            roles: { create: { roleId: listenerRoleId } },
          },
        });
        await this.audit.record(
          {
            action: 'auth.register',
            actorId: created.id,
            targetType: 'user',
            targetId: created.id,
            metadata: { method: 'password' },
          },
          meta,
          tx,
        );
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.conflict(
          'EMAIL_ALREADY_REGISTERED',
          'An account with this email already exists. Try signing in.',
        );
      }
      throw error;
    }

    await this.sendVerificationEmail(user.id, user.email, input.displayName);
    return this.issueSession(user.id, input.clientType, meta);
  }

  async login(
    input: Output<LoginInput>,
    meta: RequestMeta,
  ): Promise<LoginResponse | IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    if (!user || !user.passwordHash) {
      await this.passwords.verifyDummy(input.password);
      await this.audit.record(
        {
          action: 'auth.login.failure',
          metadata: { reason: 'unknown_account', emailHash: sha256Hex(input.email) },
        },
        meta,
      );
      throw INVALID_CREDENTIALS();
    }
    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      await this.audit.record(
        {
          action: 'auth.login.failure',
          actorId: user.id,
          targetType: 'user',
          targetId: user.id,
          metadata: { reason: 'bad_password' },
        },
        meta,
      );
      throw INVALID_CREDENTIALS();
    }
    return this.completePrimaryAuthentication(user, input.clientType, meta, 'password');
  }

  /** Shared post-credential checks: account state, admin-console access, MFA challenge. */
  private async completePrimaryAuthentication(
    user: User,
    clientType: ClientType,
    meta: RequestMeta,
    method: 'password' | OAuthProvider,
  ): Promise<LoginResponse | IssuedSession> {
    if (user.status === 'suspended') {
      throw AppError.forbidden(
        'This account has been suspended. Contact support for help.',
        'ACCOUNT_SUSPENDED',
      );
    }
    if (user.status !== 'active') throw INVALID_CREDENTIALS();

    if (clientType === 'admin') await this.assertStaff(user.id);

    if (await this.mfa.isEnabled(user.id)) {
      const mfaToken = await this.tokens.signMfaToken({ userId: user.id, clientType });
      return { mfaRequired: true, mfaToken };
    }
    return this.issueSession(user.id, clientType, meta, method);
  }

  async completeMfa(
    input: { mfaToken: string; code: string; clientType: ClientType },
    meta: RequestMeta,
  ): Promise<IssuedSession> {
    const claims = await this.tokens.verifyMfaToken(input.mfaToken);
    if (claims.clientType !== input.clientType) {
      throw AppError.unauthorized(
        'INVALID_TOKEN',
        'Your sign-in challenge is not valid for this app.',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id: claims.userId } });
    if (!user || user.status !== 'active') throw INVALID_CREDENTIALS();
    await this.mfa.verifyCode(user.id, input.code, meta, claims.challengeId);
    return this.issueSession(user.id, input.clientType, meta, 'mfa');
  }

  private async assertStaff(userId: string): Promise<void> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { key: true } } },
    });
    if (!isStaff(roles.map((r) => r.role.key))) {
      throw AppError.forbidden('The admin console is only available to MusicVerse staff.');
    }
  }

  private async issueSession(
    userId: string,
    clientType: ClientType,
    meta: RequestMeta,
    method: string = 'password',
  ): Promise<IssuedSession> {
    const { session, refreshToken } = await this.prisma.$transaction(async (tx) => {
      const created = await this.sessions.create(userId, clientType, meta, tx);
      await tx.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
      await this.audit.record(
        {
          action: 'auth.login.success',
          actorId: userId,
          targetType: 'session',
          targetId: created.session.id,
          metadata: { method, clientType },
        },
        meta,
        tx,
      );
      return created;
    });
    const accessToken = await this.tokens.signAccessToken({ userId, sessionId: session.id });
    const user = await loadCurrentUser(this.prisma, userId);
    return {
      clientType,
      refreshToken,
      response: { mfaRequired: false, accessToken, expiresIn: this.tokens.accessTtlSeconds, user },
    };
  }

  // ------------------------------------------------------------------ token lifecycle

  async refresh(
    refreshToken: string,
    clientType: ClientType,
    meta: RequestMeta,
  ): Promise<{ accessToken: string; expiresIn: number; refreshToken: string }> {
    const rotated = await this.sessions.rotate(refreshToken, clientType, meta);
    const accessToken = await this.tokens.signAccessToken({
      userId: rotated.session.userId,
      sessionId: rotated.session.id,
    });
    return {
      accessToken,
      expiresIn: this.tokens.accessTtlSeconds,
      refreshToken: rotated.refreshToken,
    };
  }

  async logout(refreshToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (!refreshToken) return;
    const session = await this.sessions.findByRefreshToken(refreshToken);
    if (!session || session.revokedAt) return;
    await this.sessions.revoke(session.id, 'logout');
    await this.audit.record(
      {
        action: 'auth.logout',
        actorId: session.userId,
        targetType: 'session',
        targetId: session.id,
      },
      meta,
    );
  }

  async revokeOwnSession(userId: string, sessionId: string, meta: RequestMeta): Promise<void> {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw AppError.notFound('Session not found.');
    if (await this.sessions.revoke(session.id, 'user_revoked')) {
      await this.audit.record(
        {
          action: 'auth.session.revoked',
          actorId: userId,
          targetType: 'session',
          targetId: session.id,
        },
        meta,
      );
    }
  }

  // ------------------------------------------------------------------ email verification

  private async sendVerificationEmail(
    userId: string,
    email: string,
    name: string,
  ): Promise<boolean> {
    const token = await this.verification.issue(userId, 'email_verification');
    return this.mail.send({
      to: email,
      ...verificationEmail(name, this.mail.link('/verify-email', { token })),
    });
  }

  async verifyEmail(token: string, meta: RequestMeta): Promise<void> {
    const userId = await this.verification.consume(token, 'email_verification');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
      await this.authz.invalidateUser(userId);
      await this.audit.record(
        { action: 'auth.email.verified', actorId: userId, targetType: 'user', targetId: userId },
        meta,
      );
    }
  }

  async resendVerification(userId: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    if (user.emailVerifiedAt) return { sent: false };
    const sent = await this.sendVerificationEmail(
      user.id,
      user.email,
      user.profile?.displayName ?? 'there',
    );
    if (!sent)
      throw AppError.unavailable(
        'SERVICE_UNAVAILABLE',
        'We could not send the email right now. Try again shortly.',
      );
    return { sent: true };
  }

  // ------------------------------------------------------------------ passwords

  /** Always succeeds from the caller's perspective to avoid revealing which emails are registered. */
  async forgotPassword(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!user || user.status !== 'active') return;
    const token = await this.verification.issue(user.id, 'password_reset');
    await this.audit.record(
      {
        action: 'auth.password.reset_requested',
        actorId: user.id,
        targetType: 'user',
        targetId: user.id,
      },
      meta,
    );
    await this.mail.send({
      to: user.email,
      ...passwordResetEmail(
        user.profile?.displayName ?? 'there',
        this.mail.link('/reset-password', { token }),
      ),
    });
  }

  async resetPassword(input: ResetPasswordInput, meta: RequestMeta): Promise<void> {
    const userId = await this.verification.consume(input.token, 'password_reset');
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    if (user.status !== 'active')
      throw AppError.forbidden('This account is not active.', 'ACCOUNT_SUSPENDED');
    const passwordHash = await this.passwords.hash(input.password);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        // Completing a reset proves control of the inbox, so the email is verified too.
        data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      });
      await this.audit.record(
        { action: 'auth.password.reset', actorId: userId, targetType: 'user', targetId: userId },
        meta,
        tx,
      );
    });
    await this.sessions.revokeAllForUser(userId, 'password_reset');
    await this.authz.invalidateUser(userId);
    await this.mail.send({
      to: user.email,
      ...passwordChangedEmail(user.profile?.displayName ?? 'there'),
    });
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    input: ChangePasswordInput,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    if (
      !user.passwordHash ||
      !(await this.passwords.verify(user.passwordHash, input.currentPassword))
    ) {
      throw AppError.unauthorized('INVALID_CREDENTIALS', 'Your current password is incorrect.');
    }
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await this.audit.record(
        { action: 'auth.password.changed', actorId: userId, targetType: 'user', targetId: userId },
        meta,
        tx,
      );
    });
    await this.sessions.revokeAllForUser(userId, 'password_changed', currentSessionId);
    await this.mail.send({
      to: user.email,
      ...passwordChangedEmail(user.profile?.displayName ?? 'there'),
    });
  }

  // ------------------------------------------------------------------ social sign-in

  async oauthSignIn(
    provider: OAuthProvider,
    input: Output<OAuthSignInInput>,
    meta: RequestMeta,
  ): Promise<LoginResponse | IssuedSession> {
    const identity = await this.verifiers[provider].verify(input.idToken, input.nonce);

    const linked = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: identity.subject } },
      include: { user: true },
    });
    if (linked)
      return this.completePrimaryAuthentication(linked.user, input.clientType, meta, provider);

    if (!identity.email) {
      throw AppError.badRequest(
        'PROVIDER_TOKEN_INVALID',
        'Your provider did not share an email address, which MusicVerse requires.',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email: identity.email } });
    if (existing) {
      // Only link when the provider vouches for the email; otherwise an attacker could take over
      // an account by creating a provider identity with someone else's address.
      if (!identity.emailVerified) {
        throw AppError.conflict(
          'EMAIL_ALREADY_REGISTERED',
          'An account with this email already exists. Sign in with your password.',
        );
      }
      const wasUnverified = !existing.emailVerifiedAt;
      const user = await this.prisma.$transaction(async (tx) => {
        await tx.oAuthAccount.create({
          data: {
            userId: existing.id,
            provider,
            providerAccountId: identity.subject,
            email: identity.email,
          },
        });
        const updated = await tx.user.update({
          where: { id: existing.id },
          data: wasUnverified
            ? // The pre-existing password was never proven to belong to the inbox owner: drop it.
              { emailVerifiedAt: new Date(), passwordHash: null }
            : {},
        });
        await this.audit.record(
          {
            action: 'auth.oauth.linked',
            actorId: existing.id,
            targetType: 'user',
            targetId: existing.id,
            metadata: { provider, clearedUnverifiedPassword: wasUnverified },
          },
          meta,
          tx,
        );
        return updated;
      });
      if (wasUnverified) await this.sessions.revokeAllForUser(user.id, 'admin_revoked');
      await this.authz.invalidateUser(user.id);
      return this.completePrimaryAuthentication(user, input.clientType, meta, provider);
    }

    if (input.clientType === 'admin') {
      throw AppError.forbidden('Administrator accounts cannot be created through social sign-in.');
    }
    const listenerRoleId = await this.roles.idFor('listener');
    const displayName = (
      input.displayName ??
      identity.name ??
      identity.email.split('@')[0] ??
      'Listener'
    ).slice(0, 80);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: identity.email!,
          emailVerifiedAt: identity.emailVerified ? new Date() : null,
          profile: { create: { displayName, preferences: DEFAULT_PREFERENCES as never } },
          roles: { create: { roleId: listenerRoleId } },
          oauthAccounts: {
            create: { provider, providerAccountId: identity.subject, email: identity.email },
          },
        },
      });
      await this.audit.record(
        {
          action: 'auth.oauth.registered',
          actorId: created.id,
          targetType: 'user',
          targetId: created.id,
          metadata: { provider },
        },
        meta,
        tx,
      );
      return created;
    });
    if (!identity.emailVerified) await this.sendVerificationEmail(user.id, user.email, displayName);
    this.logger.log(`New ${provider} account ${user.id}`);
    return this.issueSession(user.id, input.clientType, meta, provider);
  }
}
