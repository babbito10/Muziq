import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the real stack: the built API (against a dedicated e2e database, with
 * migrations + seed applied first) and the production web build. Email goes through the real SMTP
 * transport to Mailpit, whose HTTP API the tests read verification links from.
 *
 * Prerequisites: PostgreSQL, Redis and Mailpit running (see infrastructure/docker), and
 * `pnpm build` completed.
 */
const API_PORT = Number(process.env.E2E_API_PORT ?? 4100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://musicverse:musicverse@localhost:5432/musicverse_e2e?schema=public';

export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /responsive\.spec\.ts/ },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'npx prisma migrate deploy && node dist/database/seed.js && node dist/main.js',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/api/v1/health/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        DATABASE_URL,
        REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://localhost:6379/14',
        JWT_ACCESS_SECRET: 'e2e-secret-that-is-definitely-long-enough-123',
        MFA_ENCRYPTION_KEY: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
        WEB_APP_URL: `http://localhost:${WEB_PORT}`,
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        COOKIE_SECURE: 'false',
        RATE_LIMIT_ENABLED: 'false',
        MAIL_TRANSPORT: 'smtp',
        SMTP_HOST: process.env.E2E_SMTP_HOST ?? 'localhost',
        SMTP_PORT: process.env.E2E_SMTP_PORT ?? '1025',
        SWAGGER_ENABLED: 'false',
      },
    },
    {
      command: `npx next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { PUBLIC_API_URL: `http://localhost:${API_PORT}/api/v1` },
    },
  ],
});
