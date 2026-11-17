import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : v === 'true' || v === '1'));

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    WEB_APP_URL: z.url().default('http://localhost:3000'),
    CORS_ORIGINS: csv,
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
    SWAGGER_ENABLED: bool(true),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    MFA_ENCRYPTION_KEY: z
      .string()
      .refine(
        (v) => Buffer.from(v, 'base64').length === 32,
        'MFA_ENCRYPTION_KEY must be 32 bytes, base64-encoded',
      ),
    COOKIE_SECURE: bool(true),
    RATE_LIMIT_ENABLED: bool(true),

    MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
    MAIL_FROM: z.string().min(3).default('MusicVerse <no-reply@musicverse.local>'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().optional(),
    SMTP_SECURE: bool(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),

    GOOGLE_CLIENT_IDS: csv,
    APPLE_CLIENT_IDS: csv,
    /** Overridable for tests only. */
    GOOGLE_JWKS_URL: z.url().default('https://www.googleapis.com/oauth2/v3/certs'),
    APPLE_JWKS_URL: z.url().default('https://appleid.apple.com/auth/keys'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.MAIL_TRANSPORT === 'console') {
        ctx.addIssue({
          code: 'custom',
          path: ['MAIL_TRANSPORT'],
          message: 'The console mail transport is development-only; configure SMTP in production',
        });
      }
      if (!env.COOKIE_SECURE) {
        ctx.addIssue({
          code: 'custom',
          path: ['COOKIE_SECURE'],
          message: 'Cookies must be Secure in production',
        });
      }
    }
    if (env.MAIL_TRANSPORT === 'smtp' && !env.SMTP_HOST) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST is required for smtp transport',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  port: number;
  logLevel: Env['LOG_LEVEL'];
  webAppUrl: string;
  corsOrigins: string[];
  trustProxy: number;
  swaggerEnabled: boolean;
  databaseUrl: string;
  redisUrl: string;
  auth: {
    accessSecret: string;
    accessTtlSeconds: number;
    refreshTtlDays: number;
    mfaEncryptionKey: Buffer;
    cookieSecure: boolean;
  };
  rateLimitEnabled: boolean;
  mail: {
    transport: 'console' | 'smtp';
    from: string;
    smtp: { host?: string; port?: number; secure: boolean; user?: string; password?: string };
  };
  oauth: {
    google: { clientIds: string[]; jwksUrl: string };
    apple: { clientIds: string[]; jwksUrl: string };
  };
}

export class ConfigValidationError extends Error {}

/** Parse and validate the environment. Throws with every problem listed so boot fails fast. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ConfigValidationError(`Invalid environment configuration:\n${problems}`);
  }
  const env = result.data;
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    webAppUrl: env.WEB_APP_URL.replace(/\/$/, ''),
    corsOrigins: env.CORS_ORIGINS,
    trustProxy: env.TRUST_PROXY,
    swaggerEnabled: env.SWAGGER_ENABLED,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      mfaEncryptionKey: Buffer.from(env.MFA_ENCRYPTION_KEY, 'base64'),
      cookieSecure: env.COOKIE_SECURE,
    },
    rateLimitEnabled: env.RATE_LIMIT_ENABLED,
    mail: {
      transport: env.MAIL_TRANSPORT,
      from: env.MAIL_FROM,
      smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER || undefined,
        password: env.SMTP_PASSWORD || undefined,
      },
    },
    oauth: {
      google: { clientIds: env.GOOGLE_CLIENT_IDS, jwksUrl: env.GOOGLE_JWKS_URL },
      apple: { clientIds: env.APPLE_CLIENT_IDS, jwksUrl: env.APPLE_JWKS_URL },
    },
  };
}
