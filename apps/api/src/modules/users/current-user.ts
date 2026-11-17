import { permissionsForRoles } from '@musicverse/auth';
import type { CurrentUser, OAuthProvider, RoleKey, UserPreferences } from '@musicverse/types';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  explicitContent: true,
  emailNotifications: { product: true, social: true, security: true },
};

/** Merge stored (possibly partial / older-shaped) preferences with defaults. */
export function normalisePreferences(stored: unknown): UserPreferences {
  const value = (stored && typeof stored === 'object' ? stored : {}) as Partial<UserPreferences>;
  return {
    theme: value.theme ?? DEFAULT_PREFERENCES.theme,
    explicitContent: value.explicitContent ?? DEFAULT_PREFERENCES.explicitContent,
    emailNotifications: {
      ...DEFAULT_PREFERENCES.emailNotifications,
      ...(value.emailNotifications ?? {}),
    },
  };
}

export const currentUserInclude = {
  profile: true,
  roles: { select: { role: { select: { key: true } } } },
  oauthAccounts: { select: { provider: true } },
  mfaFactors: { where: { confirmedAt: { not: null } }, select: { id: true } },
} satisfies Prisma.UserInclude;

export type UserWithRelations = Prisma.UserGetPayload<{ include: typeof currentUserInclude }>;

export function toCurrentUser(user: UserWithRelations): CurrentUser {
  const roles = user.roles.map((r) => r.role.key as RoleKey).sort();
  return {
    id: user.id,
    email: user.email,
    emailVerified: !!user.emailVerifiedAt,
    status: user.status,
    mfaEnabled: user.mfaFactors.length > 0,
    hasPassword: !!user.passwordHash,
    createdAt: user.createdAt.toISOString(),
    profile: {
      displayName: user.profile?.displayName ?? user.email.split('@')[0]!,
      username: user.profile?.username ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null,
      bio: user.profile?.bio ?? null,
      countryCode: user.profile?.countryCode ?? null,
      locale: user.profile?.locale ?? 'en',
    },
    preferences: normalisePreferences(user.profile?.preferences),
    roles,
    permissions: permissionsForRoles(roles),
    linkedProviders: [...new Set(user.oauthAccounts.map((a) => a.provider as OAuthProvider))],
  };
}

export async function loadCurrentUser(
  db: Pick<Prisma.TransactionClient, 'user'>,
  userId: string,
): Promise<CurrentUser> {
  const user = await db.user.findUnique({ where: { id: userId }, include: currentUserInclude });
  if (!user) throw AppError.notFound('User not found.');
  return toCurrentUser(user);
}
