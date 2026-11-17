/**
 * Idempotent seed. Safe to run on every deployment:
 *  1. Synchronises roles, permissions and role_permissions from the canonical matrix in
 *     @musicverse/auth (adds new, updates descriptions, removes stale role→permission links).
 *  2. Optionally creates a first super administrator from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 *
 * Run: `pnpm --filter @musicverse/api db:seed` (dev) or `node dist/database/seed.js` (container).
 */
import { ROLE_DEFINITIONS } from '@musicverse/auth';
import { PERMISSION_KEYS, ROLE_KEYS } from '@musicverse/types';
import { emailSchema, passwordSchema } from '@musicverse/validation';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'streaming:play': 'Stream authorised music',
  'library:manage': 'Manage playlists, favourites and history',
  'social:post': 'Publish posts',
  'social:comment': 'Comment and reply',
  'social:follow': 'Follow artists and users',
  'social:report': 'Report content and users',
  'catalogue:upload': 'Upload music with rights declarations',
  'catalogue:manage_own': 'Manage own tracks and albums',
  'artist:manage_own': 'Manage artist profiles the user belongs to',
  'creator:projects': 'Use Creator Studio projects',
  'ai:generate': 'Create AI generation jobs',
  'dj:workspace': 'Use the DJ workspace',
  'marketplace:sell': 'List products and services',
  'marketplace:buy': 'Purchase from the marketplace',
  'learning:teach': 'Publish lessons',
  'analytics:view_own': 'View analytics for own content',
  'moderation:review': 'Review uploads and reports',
  'moderation:takedown': 'Action takedowns and appeals',
  'admin:users.read': 'View user accounts',
  'admin:users.manage': 'Suspend and reinstate users',
  'admin:roles.manage': 'Grant and revoke non-administrator roles',
  'admin:roles.manage_staff': 'Grant and revoke administrator roles',
  'admin:audit.read': 'Read audit logs',
  'admin:payments.read': 'View payment operations',
  'admin:ai.read': 'View AI usage',
};

export async function syncRolesAndPermissions(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const permissionIds = new Map<string, string>();
    for (const key of PERMISSION_KEYS) {
      const description = PERMISSION_DESCRIPTIONS[key] ?? key;
      const permission = await tx.permission.upsert({
        where: { key },
        create: { key, description },
        update: { description },
      });
      permissionIds.set(key, permission.id);
    }

    for (const key of ROLE_KEYS) {
      const def = ROLE_DEFINITIONS[key];
      const role = await tx.role.upsert({
        where: { key },
        create: {
          key,
          name: def.name,
          description: def.description,
          isStaff: def.isStaff,
          isSelfAssignable: def.isSelfAssignable,
        },
        update: {
          name: def.name,
          description: def.description,
          isStaff: def.isStaff,
          isSelfAssignable: def.isSelfAssignable,
        },
      });
      const wanted = def.permissions.map((p) => permissionIds.get(p)!);
      await tx.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { notIn: wanted } },
      });
      await tx.rolePermission.createMany({
        data: wanted.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  });
}

export async function ensureSuperAdmin(
  prisma: PrismaClient,
  emailInput: string | undefined,
  password: string | undefined,
): Promise<'created' | 'exists' | 'skipped'> {
  if (!emailInput || !password) return 'skipped';
  const email = emailSchema.parse(emailInput);
  passwordSchema.parse(password);
  const roles = await prisma.role.findMany({ where: { key: { in: ['listener', 'super_admin'] } } });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Ensure the role, but never overwrite an existing password.
    for (const role of roles) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: existing.id, roleId: role.id } },
        create: { userId: existing.id, roleId: role.id },
        update: {},
      });
    }
    return 'exists';
  }
  await prisma.user.create({
    data: {
      email,
      emailVerifiedAt: new Date(),
      passwordHash: await hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
        outputLen: 32,
      }),
      profile: { create: { displayName: 'MusicVerse Admin', preferences: {} } },
      roles: { create: roles.map((role) => ({ roleId: role.id })) },
    },
  });
  return 'created';
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await syncRolesAndPermissions(prisma);
    console.info(
      `Synchronised ${ROLE_KEYS.length} roles and ${PERMISSION_KEYS.length} permissions.`,
    );
    const admin = await ensureSuperAdmin(
      prisma,
      process.env.SEED_ADMIN_EMAIL,
      process.env.SEED_ADMIN_PASSWORD,
    );
    console.info(`Super administrator: ${admin}.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
