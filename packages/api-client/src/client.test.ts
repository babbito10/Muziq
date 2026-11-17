import { createApiClient, createMemoryTokenStore } from './client';
import { ApiError, isApiError } from './errors';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function setup(handler: Handler, refreshMode: 'cookie' | 'body' = 'cookie') {
  const calls: { url: string; init: RequestInit }[] = [];
  const tokenStore = createMemoryTokenStore();
  const onSessionExpired = jest.fn();
  const client = createApiClient({
    baseUrl: 'http://api.test/api/v1',
    clientType: refreshMode === 'cookie' ? 'web' : 'mobile',
    refreshMode,
    tokenStore,
    onSessionExpired,
    fetch: (async (input: string, init: RequestInit) => {
      calls.push({ url: input, init });
      return handler(input, init);
    }) as unknown as typeof fetch,
  });
  return { client, calls, tokenStore, onSessionExpired };
}

const user = { id: 'u1', email: 'a@b.co' };

describe('ApiClient', () => {
  it('stores tokens after login and sends bearer header afterwards', async () => {
    const { client, calls } = setup((url) => {
      if (url.endsWith('/auth/login')) {
        return json(200, { mfaRequired: false, accessToken: 'A1', expiresIn: 900, user });
      }
      return json(200, user);
    });
    await client.auth.login({ email: 'a@b.co', password: 'x' });
    await client.users.me();
    const meCall = calls[1]!;
    expect((meCall.init.headers as Record<string, string>).authorization).toBe('Bearer A1');
    const loginBody = JSON.parse(calls[0]!.init.body as string);
    expect(loginBody.clientType).toBe('web');
    expect(calls[0]!.init.credentials).toBe('include');
  });

  it('does not store tokens on an MFA challenge', async () => {
    const { client, tokenStore } = setup(() => json(200, { mfaRequired: true, mfaToken: 'm' }));
    const result = await client.auth.login({ email: 'a@b.co', password: 'x' });
    expect(result.mfaRequired).toBe(true);
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it('refreshes once on 401 and retries the request', async () => {
    let meCalls = 0;
    const { client, calls, tokenStore } = setup((url) => {
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'A2', expiresIn: 900 });
      meCalls += 1;
      return meCalls === 1
        ? json(401, {
            error: { code: 'UNAUTHENTICATED', message: 'x', details: null, requestId: null },
          })
        : json(200, user);
    });
    await tokenStore.setTokens({ accessToken: 'A1', expiresIn: 900 });
    await expect(client.users.me()).resolves.toEqual(user);
    const refreshCall = calls.find((c) => c.url.endsWith('/auth/refresh'))!;
    expect((refreshCall.init.headers as Record<string, string>)['x-csrf-protection']).toBe('1');
    expect(tokenStore.getAccessToken()).toBe('A2');
  });

  it('shares a single refresh between concurrent 401s', async () => {
    let refreshes = 0;
    const { client, tokenStore } = setup(async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 5));
        return json(200, { accessToken: 'A2', expiresIn: 900 });
      }
      const auth = (init.headers as Record<string, string>).authorization;
      return auth === 'Bearer A2'
        ? json(200, user)
        : json(401, {
            error: { code: 'UNAUTHENTICATED', message: 'x', details: null, requestId: null },
          });
    });
    await tokenStore.setTokens({ accessToken: 'A1', expiresIn: 900 });
    await Promise.all([client.users.me(), client.users.me(), client.auth.sessions()]);
    expect(refreshes).toBe(1);
  });

  it('sends the refresh token in the body for mobile and signals expiry when refresh fails', async () => {
    const { client, calls, tokenStore, onSessionExpired } = setup((url) => {
      if (url.endsWith('/auth/refresh'))
        return json(401, {
          error: { code: 'INVALID_TOKEN', message: 'x', details: null, requestId: null },
        });
      return json(401, {
        error: { code: 'UNAUTHENTICATED', message: 'x', details: null, requestId: null },
      });
    }, 'body');
    await tokenStore.setTokens({ accessToken: 'A1', refreshToken: 'R'.repeat(43), expiresIn: 900 });
    await expect(client.users.me()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const refreshBody = JSON.parse(
      calls.find((c) => c.url.endsWith('/auth/refresh'))!.init.body as string,
    );
    expect(refreshBody).toEqual({ clientType: 'mobile', refreshToken: 'R'.repeat(43) });
    expect(onSessionExpired).toHaveBeenCalled();
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it('maps error envelopes and network failures to ApiError', async () => {
    const { client } = setup(() =>
      json(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid',
          details: [{ path: 'email', message: 'bad' }],
          requestId: 'r1',
        },
      }),
    );
    const error = await client.auth.forgotPassword({ email: 'x' }).catch((e: unknown) => e);
    expect(isApiError(error, 'VALIDATION_FAILED')).toBe(true);
    expect((error as ApiError).issues[0]?.path).toBe('email');
    expect((error as ApiError).requestId).toBe('r1');

    const offline = setup(() => {
      throw new TypeError('fetch failed');
    });
    await expect(offline.client.health.ready()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });

  it('serialises query parameters and skips empty values', async () => {
    const { client, calls } = setup(() =>
      json(200, { data: [], page: { nextCursor: null, limit: 20 } }),
    );
    await client.admin.listUsers({ limit: 20, q: '', status: 'active' });
    expect(calls[0]!.url).toBe('http://api.test/api/v1/admin/users?limit=20&status=active');
  });

  it('clears tokens on logout even if the request fails', async () => {
    const { client, tokenStore } = setup(() => json(500, null));
    await tokenStore.setTokens({ accessToken: 'A1', expiresIn: 900 });
    await expect(client.auth.logout()).rejects.toBeInstanceOf(ApiError);
    expect(tokenStore.getAccessToken()).toBeNull();
  });
});
