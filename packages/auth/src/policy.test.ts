import { PERMISSION_KEYS, ROLE_KEYS } from '@musicverse/types';
import { ROLE_DEFINITIONS } from './matrix';
import { canManageRole, hasPermissions, isStaff, permissionsForRoles } from './policy';

describe('role matrix', () => {
  it('defines every role key exactly once', () => {
    expect(Object.keys(ROLE_DEFINITIONS).sort()).toEqual([...ROLE_KEYS].sort());
  });

  it('only references known permissions', () => {
    for (const def of Object.values(ROLE_DEFINITIONS)) {
      for (const p of def.permissions) expect(PERMISSION_KEYS).toContain(p);
    }
  });

  it('never makes a staff role self-assignable', () => {
    for (const def of Object.values(ROLE_DEFINITIONS)) {
      expect(def.isStaff && def.isSelfAssignable).toBe(false);
    }
  });
});

describe('permissionsForRoles', () => {
  it('unions permissions across roles without duplicates', () => {
    const perms = permissionsForRoles(['listener', 'artist', 'producer']);
    expect(new Set(perms).size).toBe(perms.length);
    expect(perms).toContain('streaming:play');
    expect(perms).toContain('catalogue:upload');
    expect(perms).not.toContain('admin:users.read');
  });

  it('ignores unknown roles', () => {
    expect(permissionsForRoles(['nope'])).toEqual([]);
  });
});

describe('hasPermissions', () => {
  it('requires all permissions', () => {
    expect(hasPermissions(['listener'], ['streaming:play'])).toBe(true);
    expect(hasPermissions(['listener'], ['streaming:play', 'catalogue:upload'])).toBe(false);
    expect(hasPermissions([], [])).toBe(true);
  });
});

describe('isStaff', () => {
  it('detects staff roles', () => {
    expect(isStaff(['listener', 'moderator'])).toBe(true);
    expect(isStaff(['listener', 'artist'])).toBe(false);
  });
});

describe('canManageRole', () => {
  it('lets admins grant capability and moderator roles', () => {
    expect(canManageRole({ actorRoles: ['admin'], role: 'artist', action: 'grant', isSelf: false })).toEqual({ allowed: true });
    expect(canManageRole({ actorRoles: ['admin'], role: 'moderator', action: 'grant', isSelf: false })).toEqual({ allowed: true });
  });

  it('reserves admin and super_admin grants for super admins', () => {
    expect(canManageRole({ actorRoles: ['admin'], role: 'admin', action: 'grant', isSelf: false })).toEqual({ allowed: false, reason: 'insufficient_privilege' });
    expect(canManageRole({ actorRoles: ['admin'], role: 'super_admin', action: 'grant', isSelf: false })).toEqual({ allowed: false, reason: 'insufficient_privilege' });
    expect(canManageRole({ actorRoles: ['super_admin'], role: 'admin', action: 'grant', isSelf: false })).toEqual({ allowed: true });
  });

  it('blocks non-admins', () => {
    expect(canManageRole({ actorRoles: ['moderator'], role: 'artist', action: 'grant', isSelf: false })).toEqual({ allowed: false, reason: 'insufficient_privilege' });
  });

  it('prevents self lock-out and listener changes', () => {
    expect(canManageRole({ actorRoles: ['super_admin'], role: 'super_admin', action: 'revoke', isSelf: true })).toEqual({ allowed: false, reason: 'self_lockout' });
    expect(canManageRole({ actorRoles: ['super_admin'], role: 'listener', action: 'revoke', isSelf: false })).toEqual({ allowed: false, reason: 'not_grantable' });
    expect(canManageRole({ actorRoles: ['super_admin'], role: 'wizard', action: 'grant', isSelf: false })).toEqual({ allowed: false, reason: 'unknown_role' });
  });
});
