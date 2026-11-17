import type { OAuthProvider } from '@musicverse/types';
import type { AppConfig } from '../../../config/env';
import { APPLE_ISSUERS, GOOGLE_ISSUERS, type IdTokenVerifier, JwksIdTokenVerifier } from './id-token-verifier';

export const ID_TOKEN_VERIFIERS = Symbol('ID_TOKEN_VERIFIERS');
export type IdTokenVerifiers = Record<OAuthProvider, IdTokenVerifier>;

export function createIdTokenVerifiers(config: AppConfig): IdTokenVerifiers {
  return {
    google: new JwksIdTokenVerifier({
      provider: 'google',
      issuers: GOOGLE_ISSUERS,
      clientIds: config.oauth.google.clientIds,
      jwksUrl: config.oauth.google.jwksUrl,
      nonceMode: 'raw',
      nonceRequired: false,
    }),
    apple: new JwksIdTokenVerifier({
      provider: 'apple',
      issuers: APPLE_ISSUERS,
      clientIds: config.oauth.apple.clientIds,
      jwksUrl: config.oauth.apple.jwksUrl,
      nonceMode: 'sha256',
      nonceRequired: true,
    }),
  };
}
