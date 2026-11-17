import { ConfigValidationError, loadConfig } from './env';

const base = {
  DATABASE_URL: 'postgresql://x',
  REDIS_URL: 'redis://x',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(base);
    expect(config.port).toBe(4000);
    expect(config.auth.cookieSecure).toBe(true);
    expect(config.mail.transport).toBe('console');
    expect(config.oauth.google.clientIds).toEqual([]);
  });

  it('parses lists and booleans', () => {
    const config = loadConfig({ ...base, CORS_ORIGINS: 'http://a, http://b', COOKIE_SECURE: 'false' });
    expect(config.corsOrigins).toEqual(['http://a', 'http://b']);
    expect(config.auth.cookieSecure).toBe(false);
  });

  it('lists every problem when invalid', () => {
    expect(() => loadConfig({ JWT_ACCESS_SECRET: 'short' })).toThrow(ConfigValidationError);
    try {
      loadConfig({ JWT_ACCESS_SECRET: 'short' });
    } catch (e) {
      expect((e as Error).message).toMatch(/DATABASE_URL/);
      expect((e as Error).message).toMatch(/JWT_ACCESS_SECRET/);
      expect((e as Error).message).toMatch(/MFA_ENCRYPTION_KEY/);
    }
  });

  it('refuses the development mail transport and insecure cookies in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/MAIL_TRANSPORT/);
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'smtp', COOKIE_SECURE: 'false' }),
    ).toThrow(/COOKIE_SECURE/);
  });
});
