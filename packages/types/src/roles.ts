/**
 * Role and permission keys. The role→permission matrix lives in `@musicverse/auth`.
 */
export const CAPABILITY_ROLES = ['artist', 'producer', 'dj', 'business', 'educator'] as const;
export const STAFF_ROLES = ['moderator', 'admin', 'super_admin'] as const;
export const ROLE_KEYS = ['listener', ...CAPABILITY_ROLES, ...STAFF_ROLES] as const;

export type CapabilityRole = (typeof CAPABILITY_ROLES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];
export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSION_KEYS = [
  // Listening & library
  'streaming:play',
  'library:manage',
  // Social
  'social:post',
  'social:comment',
  'social:follow',
  'social:report',
  // Creation & catalogue
  'catalogue:upload',
  'catalogue:manage_own',
  'artist:manage_own',
  'creator:projects',
  'ai:generate',
  'dj:workspace',
  'marketplace:sell',
  'marketplace:buy',
  'learning:teach',
  'analytics:view_own',
  // Staff
  'moderation:review',
  'moderation:takedown',
  'admin:users.read',
  'admin:users.manage',
  'admin:roles.manage',
  'admin:roles.manage_staff',
  'admin:audit.read',
  'admin:payments.read',
  'admin:ai.read',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

export function isCapabilityRole(value: string): value is CapabilityRole {
  return (CAPABILITY_ROLES as readonly string[]).includes(value);
}
