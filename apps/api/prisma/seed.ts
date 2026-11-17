// Development entrypoint for `prisma db seed`; the logic lives in src so it ships in the build.
import { PrismaClient } from '@prisma/client';
import { ensureSuperAdmin, syncRolesAndPermissions } from '../src/database/seed';

async function run() {
  const prisma = new PrismaClient();
  try {
    await syncRolesAndPermissions(prisma);
    const admin = await ensureSuperAdmin(prisma, process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);
    console.info(`Seed complete (roles synchronised, super administrator: ${admin}).`);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
