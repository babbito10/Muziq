import { DELETION_GRACE_DAYS, UsersService } from '../src/modules/users/users.service';
import {
  API,
  bearer,
  createTestApp,
  login,
  PASSWORD,
  registerUser,
  resetData,
  verifyEmailDirectly,
  type TestContext,
} from './helpers';

describe('Users: profile, preferences, capabilities, deletion', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetData(ctx));
  afterAll(() => ctx.close());

  it('updates the profile and normalises the username', async () => {
    const { accessToken } = await registerUser(ctx);
    const res = await ctx.http
      .patch(`${API}/users/me/profile`)
      .set(bearer(accessToken))
      .send({ displayName: 'DJ Kim', username: 'DJ_Kim', countryCode: 'ke', bio: 'Afro-house' })
      .expect(200);
    expect(res.body.profile).toMatchObject({ displayName: 'DJ Kim', username: 'dj_kim', countryCode: 'KE', bio: 'Afro-house' });
  });

  it('rejects a username that is already taken', async () => {
    const a = await registerUser(ctx);
    const b = await registerUser(ctx);
    await ctx.http.patch(`${API}/users/me/profile`).set(bearer(a.accessToken)).send({ username: 'taken.name' }).expect(200);
    const res = await ctx.http
      .patch(`${API}/users/me/profile`)
      .set(bearer(b.accessToken))
      .send({ username: 'Taken.Name' })
      .expect(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('merges preference updates', async () => {
    const { accessToken } = await registerUser(ctx);
    await ctx.http
      .patch(`${API}/users/me/preferences`)
      .set(bearer(accessToken))
      .send({ theme: 'light', emailNotifications: { social: false } })
      .expect(200);
    const res = await ctx.http
      .patch(`${API}/users/me/preferences`)
      .set(bearer(accessToken))
      .send({ explicitContent: false })
      .expect(200);
    expect(res.body.preferences).toEqual({
      theme: 'light',
      explicitContent: false,
      emailNotifications: { product: true, social: false, security: true },
    });
  });

  it('requires a verified email before adding creator capabilities', async () => {
    const { accessToken } = await registerUser(ctx);
    const res = await ctx.http.post(`${API}/users/me/capabilities`).set(bearer(accessToken)).send({ role: 'artist' }).expect(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('lets one account become an artist and producer, with permissions applied immediately', async () => {
    const { id, accessToken } = await registerUser(ctx);
    await verifyEmailDirectly(ctx, id);
    await ctx.http.get(`${API}/users/me`).set(bearer(accessToken)).expect(200);

    const artist = await ctx.http.post(`${API}/users/me/capabilities`).set(bearer(accessToken)).send({ role: 'artist' }).expect(200);
    expect(artist.body.roles).toEqual(['artist', 'listener']);
    expect(artist.body.permissions).toContain('catalogue:upload');
    const both = await ctx.http.post(`${API}/users/me/capabilities`).set(bearer(accessToken)).send({ role: 'producer' }).expect(200);
    expect(both.body.roles).toEqual(['artist', 'listener', 'producer']);

    const removed = await ctx.http.delete(`${API}/users/me/capabilities/artist`).set(bearer(accessToken)).expect(200);
    expect(removed.body.roles).toEqual(['listener', 'producer']);
  });

  it('cannot self-assign staff roles', async () => {
    const { id, accessToken } = await registerUser(ctx);
    await verifyEmailDirectly(ctx, id);
    await ctx.http.post(`${API}/users/me/capabilities`).set(bearer(accessToken)).send({ role: 'admin' }).expect(400);
    await ctx.http.delete(`${API}/users/me/capabilities/listener`).set(bearer(accessToken)).expect(400);
  });

  it('schedules deletion: requires password, signs out, blocks login, then anonymises after the grace period', async () => {
    const { id, email, accessToken } = await registerUser(ctx);
    await ctx.http.delete(`${API}/users/me`).set(bearer(accessToken)).send({ confirm: 'DELETE', password: 'wrong password!' }).expect(401);
    await ctx.http.delete(`${API}/users/me`).set(bearer(accessToken)).send({ password: PASSWORD }).expect(400);
    await ctx.http.delete(`${API}/users/me`).set(bearer(accessToken)).send({ confirm: 'DELETE', password: PASSWORD }).expect(204);

    await ctx.http.get(`${API}/users/me`).set(bearer(accessToken)).expect(401);
    await login(ctx, email).expect(401);
    expect(ctx.mail.latest(email, 'account_deletion_scheduled')).toBeDefined();

    const users = ctx.app.get(UsersService);
    expect(await users.purgeExpiredDeletions()).toBe(0);
    const later = new Date(Date.now() + (DELETION_GRACE_DAYS + 1) * 86_400_000);
    expect(await users.purgeExpiredDeletions(later)).toBe(1);

    const anonymised = await ctx.prisma.user.findUniqueOrThrow({ where: { id }, include: { profile: true } });
    expect(anonymised).toMatchObject({ status: 'deleted', passwordHash: null, email: `deleted+${id}@deleted.invalid` });
    expect(anonymised.profile?.displayName).toBe('Deleted user');
    // The original email can be registered again.
    await registerUser(ctx, { email });
  });
});
