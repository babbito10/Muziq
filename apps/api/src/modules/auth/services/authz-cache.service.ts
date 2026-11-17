import { Injectable, Logger } from '@nestjs/common';
import { permissionsForRoles } from '@musicverse/auth';
import type { RoleKey, UserStatus } from '@musicverse/types';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import type { AuthContext } from '../auth.types';

const TTL_SECONDS = 60;
const userKey = (userId: string) => `authz:user:${userId}`;
const sessionKey = (sessionId: string) => `authz:session:${sessionId}`;

interface CachedUser {
  status: UserStatus;
  roles: RoleKey[];
  emailVerified: boolean;
}

/**
 * Resolves the authorisation context for an access token on every request.
 *
 * Access tokens are stateless, but revocation (logout, suspension, role removal) must apply
 * immediately. We therefore check the session and the user's roles on each request, cached in
 * Redis for 60 s and explicitly invalidated whenever sessions, roles or status change. When Redis
 * is unavailable we fall back to the database (fail-safe, not fail-open).
 */
@Injectable()
export class AuthzCacheService {
  private readonly logger = new Logger(AuthzCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async resolve(userId: string, sessionId: string): Promise<AuthContext | null> {
    let cachedUser: CachedUser | null = null;
    let sessionActive: boolean | null = null;
    try {
      const [userJson, sessionFlag] = await this.redis.client.mget(
        userKey(userId),
        sessionKey(sessionId),
      );
      cachedUser = userJson ? (JSON.parse(userJson) as CachedUser) : null;
      sessionActive = sessionFlag === null ? null : sessionFlag === '1';
    } catch (error) {
      this.logger.warn(`Authz cache unavailable, using database: ${(error as Error).message}`);
    }

    if (sessionActive === null) {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        select: { userId: true, revokedAt: true, expiresAt: true },
      });
      sessionActive =
        !!session &&
        session.userId === userId &&
        !session.revokedAt &&
        session.expiresAt > new Date();
      await this.set(sessionKey(sessionId), sessionActive ? '1' : '0');
    }
    if (!sessionActive) return null;

    if (!cachedUser) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          status: true,
          emailVerifiedAt: true,
          roles: { select: { role: { select: { key: true } } } },
        },
      });
      if (!user) return null;
      cachedUser = {
        status: user.status,
        emailVerified: !!user.emailVerifiedAt,
        roles: user.roles.map((r) => r.role.key as RoleKey),
      };
      await this.set(userKey(userId), JSON.stringify(cachedUser));
    }
    if (cachedUser.status !== 'active') return null;

    return {
      userId,
      sessionId,
      roles: cachedUser.roles,
      permissions: permissionsForRoles(cachedUser.roles),
      emailVerified: cachedUser.emailVerified,
      status: cachedUser.status,
    };
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.del(userKey(userId));
  }

  async invalidateSessions(sessionIds: string[]): Promise<void> {
    if (sessionIds.length > 0) await this.del(...sessionIds.map(sessionKey));
  }

  private async set(key: string, value: string): Promise<void> {
    try {
      await this.redis.client.set(key, value, 'EX', TTL_SECONDS);
    } catch {
      // Cache writes are best-effort.
    }
  }

  private async del(...keys: string[]): Promise<void> {
    try {
      await this.redis.client.del(...keys);
    } catch (error) {
      // If invalidation fails, entries still expire within TTL_SECONDS. Log loudly.
      this.logger.error(`Failed to invalidate authz cache: ${(error as Error).message}`);
    }
  }
}
