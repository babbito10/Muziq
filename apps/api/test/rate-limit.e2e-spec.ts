import { API, createTestApp, resetData, uniqueEmail, type TestContext } from './helpers';

describe('Rate limiting (Redis-backed)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp({ RATE_LIMIT_ENABLED: 'true' });
    await resetData(ctx);
  });
  afterAll(() => ctx.close());

  it('limits forgot-password to 5 requests per minute per IP with Retry-After', async () => {
    for (let i = 0; i < 5; i++) {
      await ctx.http.post(`${API}/auth/password/forgot`).send({ email: uniqueEmail() }).expect(202);
    }
    const res = await ctx.http
      .post(`${API}/auth/password/forgot`)
      .send({ email: uniqueEmail() })
      .expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    const keys = await ctx.redis.client.keys('rl:*');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('does not rate-limit health checks', async () => {
    for (let i = 0; i < 20; i++) await ctx.http.get(`${API}/health/live`).expect(200);
  });
});
