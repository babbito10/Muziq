import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, type KeyLike, SignJWT } from 'jose';
import { API, createTestApp, login, PASSWORD, registerUser, resetData, type TestContext } from './helpers';

const GOOGLE_CLIENT = 'test-google-client.apps.googleusercontent.com';
const APPLE_CLIENT = 'app.musicverse.ios';

describe('Social sign-in (ID token verification)', () => {
  describe('when providers are not configured', () => {
    let ctx: TestContext;
    beforeAll(async () => {
      ctx = await createTestApp();
    });
    afterAll(() => ctx.close());

    it('reports providers as unavailable and refuses with 503', async () => {
      await ctx.http.get(`${API}/auth/providers`).expect(200, { password: true, google: false, apple: false });
      const res = await ctx.http.post(`${API}/auth/oauth/google`).send({ idToken: 'x'.repeat(40) }).expect(503);
      expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
    });
  });

  describe('with a provider JWKS', () => {
    let ctx: TestContext;
    let server: Server;
    let privateKey: KeyLike;
    let otherKey: KeyLike;

    beforeAll(async () => {
      const pair = await generateKeyPair('RS256');
      privateKey = pair.privateKey;
      otherKey = (await generateKeyPair('RS256')).privateKey;
      const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
      server = createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ keys: [jwk] }));
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address() as AddressInfo;
      ctx = await createTestApp({
        GOOGLE_CLIENT_IDS: GOOGLE_CLIENT,
        GOOGLE_JWKS_URL: `http://127.0.0.1:${port}/google`,
        APPLE_CLIENT_IDS: APPLE_CLIENT,
        APPLE_JWKS_URL: `http://127.0.0.1:${port}/apple`,
      });
    });
    beforeEach(() => resetData(ctx));
    afterAll(async () => {
      await ctx.close();
      server.close();
    });

    function googleToken(claims: Record<string, unknown>, opts: { key?: KeyLike; aud?: string; iss?: string } = {}) {
      return new SignJWT({ email_verified: true, ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(opts.iss ?? 'https://accounts.google.com')
        .setAudience(opts.aud ?? GOOGLE_CLIENT)
        .setSubject(String(claims.sub ?? 'google-sub-1'))
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(opts.key ?? privateKey);
    }

    it('reports configured providers', async () => {
      await ctx.http.get(`${API}/auth/providers`).expect(200, { password: true, google: true, apple: true });
    });

    it('creates a verified account on first Google sign-in and reuses it afterwards', async () => {
      const idToken = await googleToken({ sub: 'g-1', email: 'Fan@Example.com', name: 'Fan Person' });
      const first = await ctx.http.post(`${API}/auth/oauth/google`).send({ idToken }).expect(200);
      expect(first.body.user).toMatchObject({
        email: 'fan@example.com',
        emailVerified: true,
        hasPassword: false,
        linkedProviders: ['google'],
        profile: { displayName: 'Fan Person' },
      });
      const second = await ctx.http.post(`${API}/auth/oauth/google`).send({ idToken }).expect(200);
      expect(second.body.user.id).toBe(first.body.user.id);
      expect(await ctx.prisma.user.count()).toBe(1);
    });

    it('rejects tokens with the wrong signature, audience or issuer', async () => {
      for (const idToken of [
        await googleToken({ email: 'a@example.com' }, { key: otherKey }),
        await googleToken({ email: 'a@example.com' }, { aud: 'someone-else' }),
        await googleToken({ email: 'a@example.com' }, { iss: 'https://evil.example' }),
      ]) {
        const res = await ctx.http.post(`${API}/auth/oauth/google`).send({ idToken }).expect(401);
        expect(res.body.error.code).toBe('PROVIDER_TOKEN_INVALID');
      }
    });

    it('links to an existing verified-email account', async () => {
      const existing = await registerUser(ctx, { email: 'linked@example.com' });
      await ctx.prisma.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } });
      const idToken = await googleToken({ sub: 'g-2', email: 'linked@example.com' });
      const res = await ctx.http.post(`${API}/auth/oauth/google`).send({ idToken }).expect(200);
      expect(res.body.user.id).toBe(existing.id);
      expect(res.body.user.hasPassword).toBe(true);
      await login(ctx, 'linked@example.com').expect(200);
    });

    it('drops an unproven password when linking to an unverified account (pre-registration takeover defence)', async () => {
      const squatter = await registerUser(ctx, { email: 'victim@example.com' });
      const idToken = await googleToken({ sub: 'g-3', email: 'victim@example.com' });
      const res = await ctx.http.post(`${API}/auth/oauth/google`).send({ idToken }).expect(200);
      expect(res.body.user).toMatchObject({ id: squatter.id, emailVerified: true, hasPassword: false });
      await login(ctx, 'victim@example.com', PASSWORD).expect(401);
    });

    it('refuses to link when the provider has not verified the email', async () => {
      await registerUser(ctx, { email: 'unverified@example.com' });
      const idToken = await googleToken({ sub: 'g-4', email: 'unverified@example.com', email_verified: false });
      const res = await ctx.http.post(`${API}/auth/oauth/google`).send({ idToken }).expect(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('requires and checks the hashed nonce for Apple', async () => {
      const nonce = 'raw-nonce-1234567890';
      const sign = (nonceClaim?: string) =>
        new SignJWT({ email: 'apple@privaterelay.appleid.com', email_verified: 'true', ...(nonceClaim ? { nonce: nonceClaim } : {}) })
          .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
          .setIssuer('https://appleid.apple.com')
          .setAudience(APPLE_CLIENT)
          .setSubject('apple-sub-1')
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(privateKey);
      const hashed = createHash('sha256').update(nonce).digest('hex');

      await ctx.http.post(`${API}/auth/oauth/apple`).send({ idToken: await sign(hashed) }).expect(401);
      await ctx.http.post(`${API}/auth/oauth/apple`).send({ idToken: await sign(hashed), nonce: 'different-nonce' }).expect(401);
      const ok = await ctx.http
        .post(`${API}/auth/oauth/apple`)
        .send({ idToken: await sign(hashed), nonce, displayName: 'Apple Fan' })
        .expect(200);
      expect(ok.body.user).toMatchObject({ emailVerified: true, linkedProviders: ['apple'], profile: { displayName: 'Apple Fan' } });
    });

    it('rejects unknown providers', async () => {
      await ctx.http.post(`${API}/auth/oauth/facebook`).send({ idToken: 'x'.repeat(40) }).expect(400);
    });
  });
});
