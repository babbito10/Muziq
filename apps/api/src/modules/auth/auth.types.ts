import type { PermissionKey, RoleKey, UserStatus } from '@musicverse/types';

/** Authenticated principal attached to `request.auth` by `JwtAuthGuard`. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  roles: RoleKey[];
  permissions: PermissionKey[];
  emailVerified: boolean;
  status: UserStatus;
}

export const REFRESH_COOKIE = { web: 'mv_refresh', admin: 'mv_admin_refresh' } as const;
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
