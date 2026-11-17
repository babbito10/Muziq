import { randomBytes } from 'node:crypto';
import { TEST_REDIS_URL, testDatabaseUrl } from './env';

// Deterministic, isolated configuration for every integration test file.
Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: testDatabaseUrl(),
  REDIS_URL: TEST_REDIS_URL,
  JWT_ACCESS_SECRET: 'integration-test-secret-that-is-long-enough-1234',
  MFA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  MAIL_TRANSPORT: 'console',
  COOKIE_SECURE: 'false',
  RATE_LIMIT_ENABLED: 'false',
  SWAGGER_ENABLED: 'true',
  WEB_APP_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:3000',
  GOOGLE_CLIENT_IDS: '',
  APPLE_CLIENT_IDS: '',
});
