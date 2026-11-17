import { createApiClient } from '@musicverse/api-client';
import {
  createSecureTokenStore,
  REFRESH_TOKEN_KEY,
  type SecureStorage,
} from './secure-token-store';

function fakeStorage(): SecureStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (k) => data.get(k) ?? null,
    setItemAsync: async (k, v) => void data.set(k, v),
    deleteItemAsync: async (k) => void data.delete(k),
  };
}

describe('secure token store', () => {
  it('keeps the access token in memory and the refresh token in secure storage', async () => {
    const storage = fakeStorage();
    const store = createSecureTokenStore(storage);
    await store.setTokens({ accessToken: 'A', refreshToken: 'R', expiresIn: 900 });
    expect(store.getAccessToken()).toBe('A');
    expect(storage.data.get(REFRESH_TOKEN_KEY)).toBe('R');
    expect([...storage.data.values()]).not.toContain('A');

    // Rotation without a new refresh token keeps the stored one.
    await store.setTokens({ accessToken: 'A2', expiresIn: 900 });
    expect(await store.getRefreshToken!()).toBe('R');

    await store.clear();
    expect(store.getAccessToken()).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('restores a session after an app restart via the stored refresh token', async () => {
    const storage = fakeStorage();
    storage.data.set(REFRESH_TOKEN_KEY, 'R'.repeat(43));
    const calls: unknown[] = [];
    const client = createApiClient({
      baseUrl: 'http://api.test/api/v1',
      clientType: 'mobile',
      refreshMode: 'body',
      tokenStore: createSecureTokenStore(storage),
      fetch: (async (_url: string, init: RequestInit) => {
        calls.push(JSON.parse(init.body as string));
        return new Response(
          JSON.stringify({ accessToken: 'A', refreshToken: 'N'.repeat(43), expiresIn: 900 }),
          { status: 200 },
        );
      }) as unknown as typeof fetch,
    });
    await expect(client.auth.refresh()).resolves.toBe(true);
    expect(calls[0]).toEqual({ clientType: 'mobile', refreshToken: 'R'.repeat(43) });
    expect(storage.data.get(REFRESH_TOKEN_KEY)).toBe('N'.repeat(43));
  });
});
