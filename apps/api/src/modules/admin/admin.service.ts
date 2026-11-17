import { Injectable } from '@nestjs/common';
import { canManageRole } from '@musicverse/auth';
import type {
  AdminUserDetail,
  AdminUserSummary,
  AuditLogEntry,
  OAuthProvider,
  Paginated,
  RoleKey,
} from '@musicverse/types';
import type { AdminListUsersQuery, AuditLogQuery } from '@musicverse/validation';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/http/request-meta';
import { pageArgs, toPage } from '../../common/pagination/cursor';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { AuthzCacheService } from '../auth/services/authz-cache.service';
import { RolesService } from '../auth/services/roles.service';
import { SessionService } from '../auth/services/session.service';

const summaryInclude = {
  profile: { select: { displayName: true } },
  roles: { select: { role: { select: { key: true } } } },
} satisfies Prisma.UserInclude;

type SummaryRow = Prisma.UserGetPayload<{ include: typeof summaryInclude }>;

function toSummary(user: SummaryRow): AdminUserSummary {
  return {
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName ?? '',
    status: user.status,
    emailVerified: !!user.emailVerifiedAt,
    roles: user.roles.map((r) => r.role.key as RoleKey).sort(),
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

const DENIAL_MESSAGES = {
  unknown_role: 'Unknown role.',
  not_grantable: 'The listener role is part of every account and cannot be changed.',
  insufficient_privilege: 'You do not have permission to manage this role.',
  self_lockout: 'You cannot remove your own administrator role.',
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly sessions: SessionService,
    private readonly authz: AuthzCacheService,
    private readonly audit: AuditService,
  ) {}

  async listUsers(query: AdminListUsersQuery): Promise<Paginated<AdminUserSummary>> {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { roles: { some: { role: { key: query.role } } } } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q.toLowerCase() } },
              { profile: { displayName: { contains: query.q, mode: 'insensitive' } } },
              { profile: { username: { contains: query.q.toLowerCase() } } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.user.findMany({ where, include: summaryInclude, ...pageArgs(query.limit, query.cursor) });
    return toPage(rows, query.limit, toSummary);
  }

  async getUser(id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ...summaryInclude,
        oauthAccounts: { select: { provider: true } },
        mfaFactors: { where: { confirmedAt: { not: null } }, select: { id: true } },
        _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } } } },
      },
    });
    if (!user) throw AppError.notFound('User not found.');
    return {
      ...toSummary(user),
      mfaEnabled: user.mfaFactors.length > 0,
      activeSessions: user._count.sessions,
      linkedProviders: [...new Set(user.oauthAccounts.map((a) => a.provider as OAuthProvider))],
    };
  }

  async changeRole(
    actor: AuthContext,
    targetId: string,
    role: RoleKey,
    action: 'grant' | 'revoke',
    meta: RequestMeta,
  ): Promise<AdminUserDetail> {
    const decision = canManageRole({ actorRoles: actor.roles, role, action, isSelf: actor.userId === targetId });
    if (!decision.allowed) throw AppError.forbidden(DENIAL_MESSAGES[decision.reason], 'ROLE_NOT_ASSIGNABLE');

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.status === 'deleted') throw AppError.notFound('User not found.');
    const roleId = await this.roles.idFor(role);

    await this.prisma.$transaction(async (tx) => {
      if (action === 'grant') {
        const existing = await tx.userRole.findUnique({ where: { userId_roleId: { userId: targetId, roleId } } });
        if (existing) return;
        await tx.userRole.create({ data: { userId: targetId, roleId, grantedById: actor.userId } });
      } else {
        const { count } = await tx.userRole.deleteMany({ where: { userId: targetId, roleId } });
        if (count === 0) return;
      }
      await this.audit.record(
        {
          action: action === 'grant' ? 'admin.role.granted' : 'admin.role.revoked',
          actorId: actor.userId,
          targetType: 'user',
          targetId,
          metadata: { role },
        },
        meta,
        tx,
      );
    });
    await this.authz.invalidateUser(targetId);
    return this.getUser(targetId);
  }

  async suspend(actor: AuthContext, targetId: string, reason: string, meta: RequestMeta): Promise<AdminUserDetail> {
    if (actor.userId === targetId) throw AppError.forbidden('You cannot suspend your own account.');
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, include: summaryInclude });
    if (!target || target.status === 'deleted') throw AppError.notFound('User not found.');
    const targetRoles = target.roles.map((r) => r.role.key);
    if (targetRoles.includes('super_admin') && !actor.roles.includes('super_admin')) {
      throw AppError.forbidden('Only a super administrator can suspend another super administrator.');
    }
    if (target.status !== 'suspended') {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: targetId }, data: { status: 'suspended', suspendedReason: reason } });
        await this.audit.record(
          { action: 'admin.user.suspended', actorId: actor.userId, targetType: 'user', targetId, metadata: { reason } },
          meta,
          tx,
        );
      });
      await this.sessions.revokeAllForUser(targetId, 'account_suspended');
      await this.authz.invalidateUser(targetId);
    }
    return this.getUser(targetId);
  }

  async reinstate(actor: AuthContext, targetId: string, meta: RequestMeta): Promise<AdminUserDetail> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw AppError.notFound('User not found.');
    if (target.status === 'suspended') {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: targetId }, data: { status: 'active', suspendedReason: null } });
        await this.audit.record({ action: 'admin.user.reinstated', actorId: actor.userId, targetType: 'user', targetId }, meta, tx);
      });
      await this.authz.invalidateUser(targetId);
    }
    return this.getUser(targetId);
  }

  async auditLogs(query: AuditLogQuery): Promise<Paginated<AuditLogEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
    };
    const rows = await this.prisma.auditLog.findMany({
      where,
      include: { actor: { select: { email: true } } },
      ...pageArgs(query.limit, query.cursor),
    });
    return toPage(rows, query.limit, (row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actorId,
      actorEmail: row.actor?.email ?? null,
      targetType: row.targetType,
      targetId: row.targetId,
      ipAddress: row.ipAddress,
      requestId: row.requestId,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
