'use client';

import { type ApiClient, createApiClient, createMemoryTokenStore } from '@musicverse/api-client';
import { readRuntimeConfig } from './runtime-config';

/**
 * Browser API client. The access token lives only in memory; the refresh token is an HttpOnly,
 * SameSite=Strict cookie scoped to the API's /api/v1/auth path that page scripts can never read.
 * The web app and API must be same-site (e.g. musicverse.app and api.musicverse.app).
 */
export const tokenStore = createMemoryTokenStore();

let sessionExpiredHandler: (() => void) | null = null;
export function onSessionExpired(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

let client: ApiClient | null = null;

/** Created lazily so the runtime config element has been parsed. */
export function getApi(): ApiClient {
  client ??= createApiClient({
    baseUrl: readRuntimeConfig().apiUrl,
    clientType: 'admin',
    refreshMode: 'cookie',
    tokenStore,
    onSessionExpired: () => sessionExpiredHandler?.(),
  });
  return client;
}

/** Convenience accessor; resolves the client on first property access. */
export const api = new Proxy({} as ApiClient, {
  get: (_target, prop) => Reflect.get(getApi(), prop),
});
