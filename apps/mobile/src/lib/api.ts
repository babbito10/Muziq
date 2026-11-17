import { createApiClient } from '@musicverse/api-client';
import * as SecureStore from 'expo-secure-store';
import { createSecureTokenStore } from './secure-token-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

let expiredHandler: (() => void) | null = null;
export function onSessionExpired(handler: (() => void) | null) {
  expiredHandler = handler;
}

export const api = createApiClient({
  baseUrl: API_URL,
  clientType: 'mobile',
  refreshMode: 'body',
  tokenStore: createSecureTokenStore(SecureStore),
  onSessionExpired: () => expiredHandler?.(),
});
