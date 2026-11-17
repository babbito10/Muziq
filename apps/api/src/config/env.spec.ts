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
    const config = loadConfig({
      ...base,
      CORS_ORIGINS: 'http://a, http://b',
      COOKIE_SECURE: 'false',
    });
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

  it('derives the web URL from Render and accepts generated secrets as the MFA key', () => {
    const config = loadConfig({
      ...base,
      RENDER_EXTERNAL_URL: 'https://musicverse.onrender.com/',
      MFA_ENCRYPTION_KEY: 'x'.repeat(44),
      MAIL_TRANSPORT: 'none',
    });
    expect(config.webAppUrl).toBe('https://musicverse.onrender.com');
    expect(config.auth.mfaEncryptionKey).toHaveLength(32);
    expect(config.mail.transport).toBe('none');
    expect(() => loadConfig({ ...base, MFA_ENCRYPTION_KEY: 'too-short' })).toThrow(
      /MFA_ENCRYPTION_KEY/,
    );
    // A real 32-byte base64 key is used unchanged.
    expect(loadConfig(base).auth.mfaEncryptionKey.equals(Buffer.alloc(32, 1))).toBe(true);
  });

  it('allows production without email configured (transport none)', () => {
    expect(
      loadConfig({ ...base, NODE_ENV: 'production', MAIL_TRANSPORT: 'none' }).isProduction,
    ).toBe(true);
  });

  it('refuses the development mail transport and insecure cookies in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/MAIL_TRANSPORT/);
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: 'production',
        MAIL_TRANSPORT: 'smtp',
        SMTP_HOST: 'smtp',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow(/COOKIE_SECURE/);
  });
});
