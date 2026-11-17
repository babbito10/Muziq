import { Inject, Injectable } from '@nestjs/common';
import type { ClientType, SessionSummary } from '@musicverse/types';
import type { Prisma, Session } from '@prisma/client';
import { APP_CONFIG } from '../../../config/config.module';
import type { AppConfig } from '../../../config/env';
import { AppError } from '../../../common/errors/app-error';
import type { RequestMeta } from '../../../common/http/request-meta';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthzCacheService } from './authz-cache.service';
import { generateOpaqueToken, sha256Hex } from './crypto';

/**
 * Two requests racing with the same refresh token (e.g. two browser tabs) are normal. Within this
 * window the loser gets INVALID_TOKEN and simply retries with the newer cookie. Presenting an old
 * token after the window is treated as theft: the whole session is revoked.
 */
export const REUSE_GRACE_MS = 15_000;

export type SessionRevokeReason =
  | 'logout'
  | 'user_revoked'
  | 'password_changed'
  | 'password_reset'
  | 'refresh_token_reuse'
  | 'account_suspended'
  | 'account_deleted'
  | 'admin_revoked';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzCacheService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private expiry(from = new Date()): Date {
    return new Date(from.getTime() + this.config.auth.refreshTtlDays * 86_400_000);
  }

  async create(
    userId: string,
    clientType: ClientType,
    meta: RequestMeta,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<{ session: Session; refreshToken: string }> {
    const refreshToken = generateOpaqueToken();
    const session = await db.session.create({
      data: {
        userId,
        clientType,
        refreshTokenHash: sha256Hex(refreshToken),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: this.expiry(),
      },
    });
    return { session, refreshToken };
  }

  /** Validate and rotate a refresh token. Returns the session and the new refresh token. */
  async rotate(
    refreshToken: string,
    clientType: ClientType,
    meta: RequestMeta,
  ): Promise<{ session: Session; refreshToken: string }> {
    const hash = sha256Hex(refreshToken);
    const now = new Date();
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });

    if (!session) {
      await this.detectReuse(hash, now, meta);
      throw AppError.unauthorized('INVALID_TOKEN', 'Your session is no longer valid. Please sign in again.');
    }
    if (session.revokedAt || session.expiresAt <= now || session.clientType !== clientType) {
      throw AppError.unauthorized('INVALID_TOKEN', 'Your session is no longer valid. Please sign in again.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId }, select: { status: true } });
    if (!user || user.status !== 'active') {
      await this.revoke(session.id, 'account_suspended');
      throw AppError.forbidden('Your account is not active.', 'ACCOUNT_SUSPENDED');
    }

    const nextToken = generateOpaqueToken();
    // Optimistic concurrency: only rotate if nobody else rotated this token in the meantime.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: hash, revokedAt: null },
      data: {
        refreshTokenHash: sha256Hex(nextToken),
        previousTokenHash: hash,
        lastUsedAt: now,
        expiresAt: this.expiry(now),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
    if (count !== 1) {
      throw AppError.unauthorized('INVALID_TOKEN', 'Your session was refreshed elsewhere. Please retry.');
    }
    return { session: { ...session, lastUsedAt: now }, refreshToken: nextToken };
  }

  private async detectReuse(hash: string, now: Date, meta: RequestMeta): Promise<void> {
    const previous = await this.prisma.session.findUnique({ where: { previousTokenHash: hash } });
    if (!previous || previous.revokedAt) return;
    if (now.getTime() - previous.lastUsedAt.getTime() < REUSE_GRACE_MS) return;
    await this.revoke(previous.id, 'refresh_token_reuse');
    await this.audit.record(
      {
        action: 'auth.refresh.reuse_detected',
        actorId: previous.userId,
        targetType: 'session',
        targetId: previous.id,
      },
      meta,
    );
    throw AppError.unauthorized(
      'TOKEN_REUSED',
      'This session was signed out for your security because an old sign-in token was reused.',
    );
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { refreshTokenHash: sha256Hex(refreshToken) } });
  }

  async revoke(sessionId: string, reason: SessionRevokeReason): Promise<boolean> {
    const { count } = await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    await this.authz.invalidateSessions([sessionId]);
    return count > 0;
  }

  async revokeAllForUser(userId: string, reason: SessionRevokeReason, exceptSessionId?: string): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      select: { id: true },
    });
    const ids = sessions.map((s) => s.id);
    if (ids.length === 0) return 0;
    await this.prisma.session.updateMany({
      where: { id: { in: ids }, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    await this.authz.invalidateSessions(ids);
    return ids.length;
  }

  async listActive(userId: string, currentSessionId: string): Promise<SessionSummary[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      clientType: s.clientType,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }
}
