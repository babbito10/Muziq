import { API, createTestApp, type TestContext } from './helpers';

describe('Platform (health, errors, headers, docs)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it('reports liveness and readiness with database and redis checks', async () => {
    await ctx.http.get(`${API}/health/live`).expect(200, { status: 'ok' });
    const res = await ctx.http.get(`${API}/health/ready`).expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database.status).toBe('up');
    expect(res.body.checks.redis.status).toBe('up');
  });

  it('returns the error envelope for unknown routes', async () => {
    const res = await ctx.http.get(`${API}/does-not-exist`).expect(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found.', details: null, requestId: expect.any(String) },
    });
  });

  it('returns VALIDATION_FAILED for malformed JSON with a request id', async () => {
    const res = await ctx.http
      .post(`${API}/auth/login`)
      .set('content-type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.requestId).toEqual(expect.any(String));
  });

  it('rejects oversized bodies', async () => {
    const res = await ctx.http
      .post(`${API}/auth/login`)
      .send({ email: 'a@b.co', password: 'x'.repeat(1_100_000) })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('propagates a valid incoming x-request-id and replaces invalid ones', async () => {
    const ok = await ctx.http.get(`${API}/health/live`).set('x-request-id', 'trace-12345678');
    expect(ok.headers['x-request-id']).toBe('trace-12345678');
    const bad = await ctx.http.get(`${API}/health/live`).set('x-request-id', 'bad id with spaces');
    expect(bad.headers['x-request-id']).not.toBe('bad id with spaces');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await ctx.http.get(`${API}/health/live`);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('applies the CORS allow-list', async () => {
    const allowed = await ctx.http
      .options(`${API}/auth/login`)
      .set('origin', 'http://localhost:3000')
      .set('access-control-request-method', 'POST');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const denied = await ctx.http
      .options(`${API}/auth/login`)
      .set('origin', 'https://evil.example')
      .set('access-control-request-method', 'POST');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves an OpenAPI document covering the v1 routes', async () => {
    const res = await ctx.http.get('/api/docs-json').expect(200);
    expect(res.body.openapi).toMatch(/^3\./);
    const paths = Object.keys(res.body.paths);
    expect(paths).toEqual(
      expect.arrayContaining(['/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/users/me', '/api/v1/admin/users']),
    );
    const registerBody = res.body.paths['/api/v1/auth/register'].post.requestBody.content['application/json'].schema;
    expect(registerBody.properties).toHaveProperty('email');
  });
});
