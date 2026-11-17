import type { PermissionKey, RoleKey } from '@musicverse/types';

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  /** Staff roles can only be granted by administrators. */
  isStaff: boolean;
  /** Users may add/remove these roles on their own account. */
  isSelfAssignable: boolean;
  permissions: readonly PermissionKey[];
}

const LISTENER: readonly PermissionKey[] = [
  'streaming:play',
  'library:manage',
  'social:post',
  'social:comment',
  'social:follow',
  'social:report',
  'marketplace:buy',
];

const CREATOR_BASE: readonly PermissionKey[] = [
  'catalogue:upload',
  'catalogue:manage_own',
  'artist:manage_own',
  'creator:projects',
  'ai:generate',
  'analytics:view_own',
  'marketplace:sell',
];

/**
 * Canonical role → permission matrix. This is the single source of truth:
 * the database seed synchronises `roles`, `permissions` and `role_permissions` from it.
 * Roles are additive — a user's permissions are the union over all held roles.
 */
export const ROLE_DEFINITIONS: Record<RoleKey, RoleDefinition> = {
  listener: {
    key: 'listener',
    name: 'Listener',
    description: 'Discover, stream and share music. Every account has this role.',
    isStaff: false,
    isSelfAssignable: false,
    permissions: LISTENER,
  },
  artist: {
    key: 'artist',
    name: 'Artist',
    description: 'Release music, manage an artist profile and engage fans.',
    isStaff: false,
    isSelfAssignable: true,
    permissions: CREATOR_BASE,
  },
  producer: {
    key: 'producer',
    name: 'Producer',
    description: 'Produce, collaborate and sell beats and services.',
    isStaff: false,
    isSelfAssignable: true,
    permissions: CREATOR_BASE,
  },
  dj: {
    key: 'dj',
    name: 'DJ',
    description: 'Prepare tracks and sets in the DJ workspace.',
    isStaff: false,
    isSelfAssignable: true,
    permissions: ['dj:workspace', 'creator:projects', 'ai:generate', 'analytics:view_own'],
  },
  business: {
    key: 'business',
    name: 'Music business',
    description: 'Studios, labels and service providers offering music services.',
    isStaff: false,
    isSelfAssignable: true,
    permissions: ['marketplace:sell', 'analytics:view_own', 'artist:manage_own'],
  },
  educator: {
    key: 'educator',
    name: 'Educator',
    description: 'Publish lessons and teach on MusicVerse Learning.',
    isStaff: false,
    isSelfAssignable: true,
    permissions: ['learning:teach', 'analytics:view_own'],
  },
  moderator: {
    key: 'moderator',
    name: 'Moderator',
    description: 'Review uploads, reports, takedowns and appeals.',
    isStaff: true,
    isSelfAssignable: false,
    permissions: ['moderation:review', 'moderation:takedown', 'admin:users.read', 'admin:audit.read'],
  },
  admin: {
    key: 'admin',
    name: 'Administrator',
    description: 'Manage users, roles and platform operations.',
    isStaff: true,
    isSelfAssignable: false,
    permissions: [
      'moderation:review',
      'moderation:takedown',
      'admin:users.read',
      'admin:users.manage',
      'admin:roles.manage',
      'admin:audit.read',
      'admin:payments.read',
      'admin:ai.read',
    ],
  },
  super_admin: {
    key: 'super_admin',
    name: 'Super administrator',
    description: 'Full platform control, including granting staff roles.',
    isStaff: true,
    isSelfAssignable: false,
    permissions: [
      'moderation:review',
      'moderation:takedown',
      'admin:users.read',
      'admin:users.manage',
      'admin:roles.manage',
      'admin:roles.manage_staff',
      'admin:audit.read',
      'admin:payments.read',
      'admin:ai.read',
    ],
  },
};
