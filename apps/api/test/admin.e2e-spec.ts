import {
  API,
  bearer,
  createTestApp,
  grantRoles,
  login,
  PASSWORD,
  registerUser,
  resetData,
  type RegisteredUser,
  type TestContext,
} from './helpers';

describe('Administration and RBAC', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetData(ctx));
  afterAll(() => ctx.close());

  async function staff(roles: Parameters<typeof grantRoles>[2]): Promise<RegisteredUser> {
    const user = await registerUser(ctx);
    await grantRoles(ctx, user.id, roles);
    return user;
  }

  it('denies listeners every admin endpoint', async () => {
    const { accessToken, id } = await registerUser(ctx);
    for (const [method, path] of [
      ['get', '/admin/users'],
      ['get', `/admin/users/${id}`],
      ['get', '/admin/audit-logs'],
      ['post', `/admin/users/${id}/suspend`],
    ] as const) {
      const res = await ctx.http[method](`${API}${path}`).set(bearer(accessToken)).send({ reason: 'test' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('lets moderators read but not manage', async () => {
    const mod = await staff(['moderator']);
    const target = await registerUser(ctx);
    await ctx.http.get(`${API}/admin/users`).set(bearer(mod.accessToken)).expect(200);
    await ctx.http.post(`${API}/admin/users/${target.id}/suspend`).set(bearer(mod.accessToken)).send({ reason: 'spam' }).expect(403);
    await ctx.http.post(`${API}/admin/users/${target.id}/roles`).set(bearer(mod.accessToken)).send({ role: 'artist' }).expect(403);
  });

  it('paginates and filters users', async () => {
    const admin = await staff(['admin']);
    for (let i = 0; i < 4; i++) await registerUser(ctx, { displayName: `Searchable ${i}` });
    const page1 = await ctx.http.get(`${API}/admin/users?limit=2`).set(bearer(admin.accessToken)).expect(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.page.nextCursor).toEqual(expect.any(String));
    const page2 = await ctx.http
      .get(`${API}/admin/users?limit=2&cursor=${page1.body.page.nextCursor}`)
      .set(bearer(admin.accessToken))
      .expect(200);
    const ids = [...page1.body.data, ...page2.body.data].map((u: { id: string }) => u.id);
    expect(new Set(ids).size).toBe(4);

    const search = await ctx.http.get(`${API}/admin/users?q=searchable`).set(bearer(admin.accessToken)).expect(200);
    expect(search.body.data).toHaveLength(4);
    const admins = await ctx.http.get(`${API}/admin/users?role=admin`).set(bearer(admin.accessToken)).expect(200);
    expect(admins.body.data.map((u: { id: string }) => u.id)).toEqual([admin.id]);
    await ctx.http.get(`${API}/admin/users?cursor=bogus`).set(bearer(admin.accessToken)).expect(400);
  });

  it('enforces the role grant hierarchy', async () => {
    const admin = await staff(['admin']);
    const superAdmin = await staff(['super_admin']);
    const target = await registerUser(ctx);

    const granted = await ctx.http
      .post(`${API}/admin/users/${target.id}/roles`)
      .set(bearer(admin.accessToken))
      .send({ role: 'moderator' })
      .expect(200);
    expect(granted.body.roles).toEqual(['listener', 'moderator']);

    const denied = await ctx.http
      .post(`${API}/admin/users/${target.id}/roles`)
      .set(bearer(admin.accessToken))
      .send({ role: 'admin' })
      .expect(403);
    expect(denied.body.error.code).toBe('ROLE_NOT_ASSIGNABLE');

    await ctx.http.post(`${API}/admin/users/${target.id}/roles`).set(bearer(superAdmin.accessToken)).send({ role: 'admin' }).expect(200);
    await ctx.http.delete(`${API}/admin/users/${target.id}/roles/listener`).set(bearer(superAdmin.accessToken)).expect(403);
    await ctx.http.delete(`${API}/admin/users/${superAdmin.id}/roles/super_admin`).set(bearer(superAdmin.accessToken)).expect(403);

    const actions = await ctx.prisma.auditLog.findMany({ where: { action: 'admin.role.granted' }, orderBy: { createdAt: 'asc' } });
    expect(actions.map((a) => (a.metadata as { role: string }).role)).toEqual(['moderator', 'admin']);
  });

  it('applies role revocation to existing access tokens immediately', async () => {
    const admin = await staff(['admin']);
    const mod = await staff(['moderator']);
    await ctx.http.get(`${API}/admin/users`).set(bearer(mod.accessToken)).expect(200);
    await ctx.http.delete(`${API}/admin/users/${mod.id}/roles/moderator`).set(bearer(admin.accessToken)).expect(200);
    await ctx.http.get(`${API}/admin/users`).set(bearer(mod.accessToken)).expect(403);
  });

  it('suspends (revoking access immediately) and reinstates users', async () => {
    const admin = await staff(['admin']);
    const target = await registerUser(ctx);
    await ctx.http.get(`${API}/users/me`).set(bearer(target.accessToken)).expect(200);

    const suspended = await ctx.http
      .post(`${API}/admin/users/${target.id}/suspend`)
      .set(bearer(admin.accessToken))
      .send({ reason: 'Uploading unlicensed recordings' })
      .expect(200);
    expect(suspended.body).toMatchObject({ status: 'suspended', activeSessions: 0 });
    await ctx.http.get(`${API}/users/me`).set(bearer(target.accessToken)).expect(401);
    await login(ctx, target.email).expect(403);

    await ctx.http.post(`${API}/admin/users/${admin.id}/suspend`).set(bearer(admin.accessToken)).send({ reason: 'self' }).expect(403);

    await ctx.http.post(`${API}/admin/users/${target.id}/reinstate`).set(bearer(admin.accessToken)).expect(200);
    await login(ctx, target.email).expect(200);
  });

  it('protects super administrators from suspension by admins', async () => {
    const admin = await staff(['admin']);
    const superAdmin = await staff(['super_admin']);
    await ctx.http.post(`${API}/admin/users/${superAdmin.id}/suspend`).set(bearer(admin.accessToken)).send({ reason: 'nope' }).expect(403);
  });

  it('exposes a filterable audit log and keeps it append-only', async () => {
    const admin = await staff(['admin']);
    const target = await registerUser(ctx);
    await ctx.http.post(`${API}/admin/users/${target.id}/suspend`).set(bearer(admin.accessToken)).send({ reason: 'abuse' }).expect(200);

    const res = await ctx.http.get(`${API}/admin/audit-logs?action=admin.`).set(bearer(admin.accessToken)).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      action: 'admin.user.suspended',
      actorId: admin.id,
      actorEmail: admin.email,
      targetId: target.id,
      metadata: { reason: 'abuse' },
    });
    const byTarget = await ctx.http.get(`${API}/admin/audit-logs?targetId=${target.id}`).set(bearer(admin.accessToken)).expect(200);
    expect(byTarget.body.data.length).toBeGreaterThan(1);

    await expect(ctx.prisma.auditLog.updateMany({ data: { action: 'tampered' } })).rejects.toThrow(/append-only/);
    await expect(ctx.prisma.auditLog.deleteMany({})).rejects.toThrow(/append-only/);
  });

  it('allows staff to sign in to the admin console with a separate cookie', async () => {
    const mod = await staff(['moderator']);
    const res = await login(ctx, mod.email, PASSWORD, 'admin').expect(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('mv_admin_refresh='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('mv_refresh='))).toBe(false);
  });
});
