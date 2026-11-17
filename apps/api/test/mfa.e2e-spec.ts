import { totp } from '../src/modules/auth/services/totp';
import { MAX_CHALLENGE_ATTEMPTS } from '../src/modules/auth/services/mfa.service';
import { API, bearer, createTestApp, login, PASSWORD, registerUser, resetData, type TestContext } from './helpers';

describe('Multi-factor authentication (TOTP)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetData(ctx));
  afterAll(() => ctx.close());

  async function enrol() {
    const user = await registerUser(ctx);
    const setup = await ctx.http.post(`${API}/auth/mfa/totp/setup`).set(bearer(user.accessToken)).expect(200);
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/MusicVerse/);
    const secret: string = setup.body.secret;
    await ctx.http
      .post(`${API}/auth/mfa/totp/confirm`)
      .set(bearer(user.accessToken))
      .send({ code: totp(secret) })
      .expect(200, { enabled: true });
    return { ...user, secret };
  }

  it('stores the secret encrypted and reports MFA as enabled', async () => {
    const { id, secret, accessToken } = await enrol();
    const factor = await ctx.prisma.mfaFactor.findFirstOrThrow({ where: { userId: id } });
    expect(factor.secretEncrypted).toMatch(/^v1:/);
    expect(factor.secretEncrypted).not.toContain(secret);
    const me = await ctx.http.get(`${API}/users/me`).set(bearer(accessToken)).expect(200);
    expect(me.body.mfaEnabled).toBe(true);
    await ctx.http.post(`${API}/auth/mfa/totp/setup`).set(bearer(accessToken)).expect(409);
  });

  it('rejects a wrong confirmation code', async () => {
    const { accessToken } = await registerUser(ctx);
    await ctx.http.post(`${API}/auth/mfa/totp/setup`).set(bearer(accessToken)).expect(200);
    const res = await ctx.http.post(`${API}/auth/mfa/totp/confirm`).set(bearer(accessToken)).send({ code: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_MFA_CODE');
  });

  it('challenges at login, completes with a fresh code and rejects replays', async () => {
    const { email, secret } = await enrol();
    const first = await login(ctx, email).expect(200);
    expect(first.body).toEqual({ mfaRequired: true, mfaToken: expect.any(String) });
    expect(first.headers['set-cookie']).toBeUndefined();

    // The code used during enrolment cannot be replayed.
    const replay = await ctx.http
      .post(`${API}/auth/mfa/verify`)
      .send({ mfaToken: first.body.mfaToken, code: totp(secret) })
      .expect(401);
    expect(replay.body.error.code).toBe('INVALID_MFA_CODE');

    const nextCode = totp(secret, Date.now() + 30_000);
    const ok = await ctx.http
      .post(`${API}/auth/mfa/verify`)
      .send({ mfaToken: first.body.mfaToken, code: nextCode })
      .expect(200);
    expect(ok.body.user.email).toBe(email);
    expect(ok.headers['set-cookie']).toBeDefined();
  });

  it('burns the challenge after too many wrong codes', async () => {
    const { email } = await enrol();
    const { body } = await login(ctx, email).expect(200);
    for (let i = 0; i < MAX_CHALLENGE_ATTEMPTS; i++) {
      await ctx.http.post(`${API}/auth/mfa/verify`).send({ mfaToken: body.mfaToken, code: '000000' }).expect(401);
    }
    const res = await ctx.http.post(`${API}/auth/mfa/verify`).send({ mfaToken: body.mfaToken, code: '000000' }).expect(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('binds the challenge to the requesting client type', async () => {
    const { email, secret } = await enrol();
    const { body } = await login(ctx, email, PASSWORD, 'web').expect(200);
    await ctx.http
      .post(`${API}/auth/mfa/verify`)
      .send({ mfaToken: body.mfaToken, code: totp(secret, Date.now() + 30_000), clientType: 'mobile' })
      .expect(401);
  });

  it('disables MFA with password and code', async () => {
    const { id, secret, accessToken, email } = await enrol();
    await ctx.prisma.mfaFactor.updateMany({ where: { userId: id }, data: { lastUsedStep: null } });
    await ctx.http
      .post(`${API}/auth/mfa/totp/disable`)
      .set(bearer(accessToken))
      .send({ password: 'wrong password', code: totp(secret) })
      .expect(401);
    await ctx.http
      .post(`${API}/auth/mfa/totp/disable`)
      .set(bearer(accessToken))
      .send({ password: PASSWORD, code: totp(secret) })
      .expect(200, { enabled: false });
    const res = await login(ctx, email).expect(200);
    expect(res.body.mfaRequired).toBe(false);
    expect(await ctx.prisma.auditLog.count({ where: { action: { in: ['auth.mfa.enabled', 'auth.mfa.disabled'] } } })).toBe(2);
  });
});
