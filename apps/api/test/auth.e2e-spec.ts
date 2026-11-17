import { REUSE_GRACE_MS } from '../src/modules/auth/services/session.service';
import {
  API,
  bearer,
  cookieValue,
  createTestApp,
  login,
  PASSWORD,
  registerUser,
  resetData,
  tokenFromMail,
  uniqueEmail,
  type TestContext,
} from './helpers';

describe('Authentication', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetData(ctx));
  afterAll(() => ctx.close());

  const refresh = (cookie: string, csrf = true) => {
    const req = ctx.http.post(`${API}/auth/refresh`).set('cookie', `mv_refresh=${cookie}`).send({ clientType: 'web' });
    return csrf ? req.set('x-csrf-protection', '1') : req;
  };

  describe('registration', () => {
    it('creates a listener, sets a secure refresh cookie and sends a verification email', async () => {
      const email = uniqueEmail('ada');
      const res = await ctx.http
        .post(`${API}/auth/register`)
        .send({ email: email.toUpperCase(), password: PASSWORD, displayName: 'Ada', acceptTerms: true })
        .expect(201);

      expect(res.body).toMatchObject({ mfaRequired: false, expiresIn: 900 });
      expect(res.body.refreshToken).toBeUndefined();
      expect(res.body.user).toMatchObject({
        email,
        emailVerified: false,
        roles: ['listener'],
        profile: { displayName: 'Ada' },
        preferences: { theme: 'dark' },
      });
      expect(res.body.user.permissions).toContain('streaming:play');
      expect(res.body.user.permissions).not.toContain('catalogue:upload');

      const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('mv_refresh='))!;
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

      expect(ctx.mail.latest(email, 'email_verification')?.text).toContain('http://localhost:3000/verify-email?token=');

      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      const audit = await ctx.prisma.auditLog.findMany({ where: { actorId: user.id } });
      expect(audit.map((a) => a.action).sort()).toEqual(['auth.login.success', 'auth.register']);
    });

    it('rejects duplicate emails case-insensitively', async () => {
      const email = uniqueEmail();
      await registerUser(ctx, { email });
      const res = await ctx.http
        .post(`${API}/auth/register`)
        .send({ email: email.toUpperCase(), password: PASSWORD, displayName: 'Dup', acceptTerms: true })
        .expect(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('returns field-level validation issues', async () => {
      const res = await ctx.http
        .post(`${API}/auth/register`)
        .send({ email: 'nope', password: 'short', displayName: '', acceptTerms: false, role: 'admin' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      const paths = res.body.error.details.map((d: { path: string }) => d.path);
      expect(paths).toEqual(expect.arrayContaining(['email', 'password', 'displayName', 'acceptTerms']));
    });

    it('refuses to create admin-console accounts', async () => {
      await ctx.http
        .post(`${API}/auth/register`)
        .send({ email: uniqueEmail(), password: PASSWORD, displayName: 'X', acceptTerms: true, clientType: 'admin' })
        .expect(403);
    });
  });

  describe('login', () => {
    it('signs in and returns the user', async () => {
      const { email } = await registerUser(ctx);
      const res = await login(ctx, email).expect(200);
      expect(res.body.mfaRequired).toBe(false);
      expect(res.body.user.email).toBe(email);
      expect(cookieValue(res.headers['set-cookie'], 'mv_refresh')).toBeDefined();
    });

    it('returns the refresh token in the body for mobile clients and sets no cookie', async () => {
      const { email } = await registerUser(ctx);
      const res = await login(ctx, email, PASSWORD, 'mobile').expect(200);
      expect(res.body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('gives the same error for a wrong password and an unknown account, and audits both', async () => {
      const { email, id } = await registerUser(ctx);
      const wrong = await login(ctx, email, 'definitely wrong pw').expect(401);
      const unknown = await login(ctx, uniqueEmail('ghost')).expect(401);
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(unknown.body.error).toMatchObject({ code: wrong.body.error.code, message: wrong.body.error.message });
      const failures = await ctx.prisma.auditLog.findMany({ where: { action: 'auth.login.failure' } });
      expect(failures).toHaveLength(2);
      expect(failures.find((f) => f.actorId === id)?.metadata).toEqual({ reason: 'bad_password' });
    });

    it('blocks suspended accounts', async () => {
      const { email, id } = await registerUser(ctx);
      await ctx.prisma.user.update({ where: { id }, data: { status: 'suspended' } });
      const res = await login(ctx, email).expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('only lets staff sign in to the admin console', async () => {
      const { email } = await registerUser(ctx);
      await login(ctx, email, PASSWORD, 'admin').expect(403);
    });
  });

  describe('access tokens', () => {
    it('rejects missing, malformed and tampered tokens', async () => {
      const { accessToken } = await registerUser(ctx);
      await ctx.http.get(`${API}/users/me`).expect(401);
      await ctx.http.get(`${API}/users/me`).set('authorization', 'Basic abc').expect(401);
      const tampered = `${accessToken.slice(0, -2)}xx`;
      const res = await ctx.http.get(`${API}/users/me`).set(bearer(tampered)).expect(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
      await ctx.http.get(`${API}/users/me`).set(bearer(accessToken)).expect(200);
    });
  });

  describe('refresh token rotation', () => {
    it('requires the CSRF header when using the cookie', async () => {
      const { refreshCookie } = await registerUser(ctx);
      const res = await refresh(refreshCookie, false).expect(403);
      expect(res.body.error.code).toBe('CSRF_CHECK_FAILED');
    });

    it('rotates the refresh token and issues a working access token', async () => {
      const { refreshCookie } = await registerUser(ctx);
      const res = await refresh(refreshCookie).expect(200);
      const next = cookieValue(res.headers['set-cookie'], 'mv_refresh');
      expect(next).toBeDefined();
      expect(next).not.toBe(refreshCookie);
      await ctx.http.get(`${API}/users/me`).set(bearer(res.body.accessToken)).expect(200);
      await refresh(next!).expect(200);
    });

    it('treats a concurrent reuse within the grace window as benign', async () => {
      const { refreshCookie } = await registerUser(ctx);
      const first = await refresh(refreshCookie).expect(200);
      const raced = await refresh(refreshCookie).expect(401);
      expect(raced.body.error.code).toBe('INVALID_TOKEN');
      await refresh(cookieValue(first.headers['set-cookie'], 'mv_refresh')!).expect(200);
    });

    it('revokes the session when an old refresh token is replayed after the grace window', async () => {
      const { refreshCookie, id } = await registerUser(ctx);
      const first = await refresh(refreshCookie).expect(200);
      await ctx.prisma.session.updateMany({
        where: { userId: id },
        data: { lastUsedAt: new Date(Date.now() - REUSE_GRACE_MS - 1000) },
      });

      const replay = await refresh(refreshCookie).expect(401);
      expect(replay.body.error.code).toBe('TOKEN_REUSED');
      expect(cookieValue(replay.headers['set-cookie'], 'mv_refresh')).toBeUndefined();

      // The legitimate holder's token and access token are now dead too.
      await refresh(cookieValue(first.headers['set-cookie'], 'mv_refresh')!).expect(401);
      await ctx.http.get(`${API}/users/me`).set(bearer(first.body.accessToken)).expect(401);
      expect(await ctx.prisma.auditLog.count({ where: { action: 'auth.refresh.reuse_detected' } })).toBe(1);
    });

    it('rotates mobile refresh tokens supplied in the body', async () => {
      const { email } = await registerUser(ctx);
      const loginRes = await login(ctx, email, PASSWORD, 'mobile').expect(200);
      const res = await ctx.http
        .post(`${API}/auth/refresh`)
        .send({ clientType: 'mobile', refreshToken: loginRes.body.refreshToken })
        .expect(200);
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.refreshToken).not.toBe(loginRes.body.refreshToken);
    });

    it('does not accept a web session token as a mobile token', async () => {
      const { refreshCookie } = await registerUser(ctx);
      await ctx.http.post(`${API}/auth/refresh`).send({ clientType: 'mobile', refreshToken: refreshCookie }).expect(401);
    });
  });

  describe('logout and sessions', () => {
    it('revokes the session immediately, including outstanding access tokens', async () => {
      const { refreshCookie, accessToken } = await registerUser(ctx);
      await ctx.http.get(`${API}/users/me`).set(bearer(accessToken)).expect(200); // warm the authz cache
      const res = await ctx.http
        .post(`${API}/auth/logout`)
        .set('cookie', `mv_refresh=${refreshCookie}`)
        .set('x-csrf-protection', '1')
        .send({})
        .expect(204);
      expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/^mv_refresh=;/);
      await ctx.http.get(`${API}/users/me`).set(bearer(accessToken)).expect(401);
      await refresh(refreshCookie).expect(401);
    });

    it('lists sessions and revokes another device', async () => {
      const { email, accessToken } = await registerUser(ctx);
      const phone = await login(ctx, email, PASSWORD, 'mobile').expect(200);
      const list = await ctx.http.get(`${API}/auth/sessions`).set(bearer(accessToken)).expect(200);
      expect(list.body).toHaveLength(2);
      expect(list.body.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
      const other = list.body.find((s: { clientType: string }) => s.clientType === 'mobile');
      await ctx.http.delete(`${API}/auth/sessions/${other.id}`).set(bearer(accessToken)).expect(204);
      await ctx.http.get(`${API}/users/me`).set(bearer(phone.body.accessToken)).expect(401);
    });

    it("cannot revoke another user's session", async () => {
      const a = await registerUser(ctx);
      const b = await registerUser(ctx);
      const bSession = await ctx.prisma.session.findFirstOrThrow({ where: { userId: b.id } });
      await ctx.http.delete(`${API}/auth/sessions/${bSession.id}`).set(bearer(a.accessToken)).expect(404);
    });
  });

  describe('email verification', () => {
    it('verifies with the emailed token exactly once', async () => {
      const { email, accessToken } = await registerUser(ctx);
      const token = tokenFromMail(ctx, email, 'email_verification');
      await ctx.http.post(`${API}/auth/email/verify`).send({ token }).expect(200, { verified: true });
      const me = await ctx.http.get(`${API}/users/me`).set(bearer(accessToken)).expect(200);
      expect(me.body.emailVerified).toBe(true);
      const again = await ctx.http.post(`${API}/auth/email/verify`).send({ token }).expect(400);
      expect(again.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects expired tokens', async () => {
      const { email } = await registerUser(ctx);
      const token = tokenFromMail(ctx, email, 'email_verification');
      await ctx.prisma.verificationToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      await ctx.http.post(`${API}/auth/email/verify`).send({ token }).expect(400);
    });

    it('resend invalidates the previous link', async () => {
      const { email, accessToken } = await registerUser(ctx);
      const first = tokenFromMail(ctx, email, 'email_verification');
      await ctx.http.post(`${API}/auth/email/resend`).set(bearer(accessToken)).expect(200, { sent: true });
      const second = tokenFromMail(ctx, email, 'email_verification');
      expect(second).not.toBe(first);
      await ctx.http.post(`${API}/auth/email/verify`).send({ token: first }).expect(400);
      await ctx.http.post(`${API}/auth/email/verify`).send({ token: second }).expect(200);
      await ctx.http.post(`${API}/auth/email/resend`).set(bearer(accessToken)).expect(200, { sent: false });
    });
  });

  describe('password recovery and change', () => {
    it('always accepts forgot-password requests without revealing accounts', async () => {
      await ctx.http.post(`${API}/auth/password/forgot`).send({ email: uniqueEmail('ghost') }).expect(202, { accepted: true });
      expect(ctx.mail.outbox.filter((m) => m.template === 'password_reset' && m.to.startsWith('ghost'))).toHaveLength(0);
    });

    it('resets the password, verifies the email and signs out every session', async () => {
      const { email, accessToken, refreshCookie } = await registerUser(ctx);
      await ctx.http.post(`${API}/auth/password/forgot`).send({ email }).expect(202);
      const token = tokenFromMail(ctx, email, 'password_reset');
      const newPassword = 'a brand new passphrase';
      await ctx.http.post(`${API}/auth/password/reset`).send({ token, password: newPassword }).expect(200);

      await ctx.http.get(`${API}/users/me`).set(bearer(accessToken)).expect(401);
      await refresh(refreshCookie).expect(401);
      await login(ctx, email).expect(401);
      const res = await login(ctx, email, newPassword).expect(200);
      expect(res.body.user.emailVerified).toBe(true);
      expect(ctx.mail.latest(email, 'password_changed')).toBeDefined();
      await ctx.http.post(`${API}/auth/password/reset`).send({ token, password: 'yet another passphrase' }).expect(400);
    });

    it('changes the password, keeping only the current session', async () => {
      const { email, accessToken } = await registerUser(ctx);
      const other = await login(ctx, email).expect(200);
      await ctx.http
        .post(`${API}/auth/password/change`)
        .set(bearer(accessToken))
        .send({ currentPassword: 'wrong password!', newPassword: 'a brand new passphrase' })
        .expect(401);
      await ctx.http
        .post(`${API}/auth/password/change`)
        .set(bearer(accessToken))
        .send({ currentPassword: PASSWORD, newPassword: 'a brand new passphrase' })
        .expect(200);
      await ctx.http.get(`${API}/users/me`).set(bearer(accessToken)).expect(200);
      await ctx.http.get(`${API}/users/me`).set(bearer(other.body.accessToken)).expect(401);
      await login(ctx, email, 'a brand new passphrase').expect(200);
    });
  });
});
