import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Resolve the integration-test database. Never point tests at a database you care about. */
export function testDatabaseUrl(): string {
  const envFile = resolve(__dirname, '..', '.env');
  if (existsSync(envFile)) {
    // Read TEST_DATABASE_URL without overriding anything already set by CI.
    process.loadEnvFile(envFile);
  }
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://musicverse:musicverse@localhost:5432/musicverse_test?schema=public';
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error(`Refusing to run integration tests against a non-test database: ${url}`);
  }
  return url;
}

export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15';
