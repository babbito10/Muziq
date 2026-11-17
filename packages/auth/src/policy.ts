import {
  isRoleKey,
  PERMISSION_KEYS,
  type PermissionKey,
  type RoleKey,
} from '@musicverse/types';
import { ROLE_DEFINITIONS } from './matrix';

/** Union of permissions granted by the given roles, in canonical order. Unknown roles are ignored. */
export function permissionsForRoles(roles: readonly string[]): PermissionKey[] {
  const granted = new Set<PermissionKey>();
  for (const role of roles) {
    if (!isRoleKey(role)) continue;
    for (const permission of ROLE_DEFINITIONS[role].permissions) granted.add(permission);
  }
  return PERMISSION_KEYS.filter((key) => granted.has(key));
}

/** True when the role set grants every one of the required permissions. */
export function hasPermissions(
  roles: readonly string[],
  required: readonly PermissionKey[],
): boolean {
  if (required.length === 0) return true;
  const granted = new Set(permissionsForRoles(roles));
  return required.every((permission) => granted.has(permission));
}

export function isStaff(roles: readonly string[]): boolean {
  return roles.some((role) => isRoleKey(role) && ROLE_DEFINITIONS[role].isStaff);
}

export type GrantDecision =
  | { allowed: true }
  | { allowed: false; reason: 'unknown_role' | 'not_grantable' | 'insufficient_privilege' | 'self_lockout' };

/**
 * Decide whether an administrator holding `actorRoles` may grant or revoke `role` on a target user.
 *
 * Rules:
 * - `listener` is implicit for every account and is never granted/revoked manually.
 * - Capability and moderator roles require `admin:roles.manage`.
 * - `admin` and `super_admin` require `admin:roles.manage_staff` (super admins only).
 * - Administrators may not revoke their own staff roles (prevents accidental lock-out).
 */
export function canManageRole(params: {
  actorRoles: readonly string[];
  role: string;
  action: 'grant' | 'revoke';
  isSelf: boolean;
}): GrantDecision {
  const { actorRoles, role, action, isSelf } = params;
  if (!isRoleKey(role)) return { allowed: false, reason: 'unknown_role' };
  if (role === 'listener') return { allowed: false, reason: 'not_grantable' };

  const required: PermissionKey[] =
    role === 'admin' || role === 'super_admin'
      ? ['admin:roles.manage_staff']
      : ['admin:roles.manage'];

  if (!hasPermissions(actorRoles, required)) {
    return { allowed: false, reason: 'insufficient_privilege' };
  }
  if (action === 'revoke' && isSelf && ROLE_DEFINITIONS[role as RoleKey].isStaff) {
    return { allowed: false, reason: 'self_lockout' };
  }
  return { allowed: true };
}
