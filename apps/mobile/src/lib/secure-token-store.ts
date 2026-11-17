import type { TokenStore } from '@musicverse/api-client';
import type { AuthTokens } from '@musicverse/types';

/** Minimal async key-value interface satisfied by expo-secure-store (and by test fakes). */
export interface SecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export const REFRESH_TOKEN_KEY = 'mv.refreshToken';

/**
 * Access token in memory only; refresh token persisted in the OS keychain/keystore so the user
 * stays signed in across app restarts without keeping a long-lived bearer token in memory dumps.
 */
export function createSecureTokenStore(storage: SecureStorage): TokenStore {
  let accessToken: string | null = null;
  return {
    getAccessToken: () => accessToken,
    getRefreshToken: () => storage.getItemAsync(REFRESH_TOKEN_KEY),
    async setTokens(tokens: AuthTokens) {
      accessToken = tokens.accessToken;
      if (tokens.refreshToken) await storage.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
    },
    async clear() {
      accessToken = null;
      await storage.deleteItemAsync(REFRESH_TOKEN_KEY);
    },
  };
}
