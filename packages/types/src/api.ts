import type { PermissionKey, RoleKey } from './roles';

/** Cursor-paginated list response. */
export interface Paginated<T> {
  data: T[];
  page: {
    nextCursor: string | null;
    limit: number;
  };
}

export type UserStatus = 'active' | 'suspended' | 'pending_deletion' | 'deleted';
export type ClientType = 'web' | 'mobile' | 'admin';
export type ThemePreference = 'dark' | 'light' | 'system';

export interface UserPreferences {
  theme: ThemePreference;
  explicitContent: boolean;
  emailNotifications: {
    product: boolean;
    social: boolean;
    security: boolean;
  };
}

export interface UserProfile {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  countryCode: string | null;
  locale: string;
}

/** The authenticated user as returned by `GET /users/me`. */
export interface CurrentUser {
  id: string;
  email: string;
  emailVerified: boolean;
  status: UserStatus;
  mfaEnabled: boolean;
  hasPassword: boolean;
  createdAt: string;
  profile: UserProfile;
  preferences: UserPreferences;
  roles: RoleKey[];
  permissions: PermissionKey[];
  linkedProviders: OAuthProvider[];
}

export type OAuthProvider = 'google' | 'apple';

export interface AuthTokens {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  /** Only present for mobile clients; web clients receive an HttpOnly cookie instead. */
  refreshToken?: string;
}

export interface AuthSuccessResponse extends AuthTokens {
  mfaRequired: false;
  user: CurrentUser;
}

export interface MfaChallengeResponse {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResponse = AuthSuccessResponse | MfaChallengeResponse;

export interface SessionSummary {
  id: string;
  clientType: ClientType;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}

export interface ProvidersResponse {
  password: true;
  google: boolean;
  apple: boolean;
}

export interface TotpSetupResponse {
  otpauthUrl: string;
  /** Base32 secret for manual entry in authenticator apps. */
  secret: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  checks: Record<string, { status: 'up' | 'down'; latencyMs?: number; error?: string }>;
  version: string;
  uptimeSeconds: number;
}

/** Admin views */
export interface AdminUserSummary {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  emailVerified: boolean;
  roles: RoleKey[];
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserDetail extends AdminUserSummary {
  mfaEnabled: boolean;
  activeSessions: number;
  linkedProviders: OAuthProvider[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
