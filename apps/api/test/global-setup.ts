import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { syncRolesAndPermissions } from '../src/database/seed';
import { testDatabaseUrl } from './env';

/**
 * Bring the dedicated test database up to the committed migrations (non-destructive
 * `migrate deploy`), then seed roles. Runs once per jest run. Individual suites isolate
 * themselves by truncating data rows (see `resetData`), never by dropping the schema.
 */
export default async function globalSetup(): Promise<void> {
  const url = testDatabaseUrl();
  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await syncRolesAndPermissions(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
