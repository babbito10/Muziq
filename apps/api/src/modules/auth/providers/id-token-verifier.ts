import type { OAuthProvider } from '@musicverse/types';
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
import { AppError } from '../../../common/errors/app-error';

export interface VerifiedIdentity {
  provider: OAuthProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface IdTokenVerifier {
  readonly provider: OAuthProvider;
  isConfigured(): boolean;
  verify(idToken: string, rawNonce?: string): Promise<VerifiedIdentity>;
}

interface JwksVerifierOptions {
  provider: OAuthProvider;
  issuers: string[];
  clientIds: string[];
  jwksUrl: string;
  /** How the provider represents the nonce claim. */
  nonceMode: 'raw' | 'sha256';
  nonceRequired: boolean;
}

/**
 * Verifies OpenID Connect ID tokens issued to our client apps by Google Sign-In / Sign in with
 * Apple: signature (provider JWKS, cached and rotated by jose), issuer, audience (our client
 * IDs), expiry and nonce. No client secret is needed because the client obtains the ID token
 * directly from the provider SDK.
 */
export class JwksIdTokenVerifier implements IdTokenVerifier {
  readonly provider: OAuthProvider;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;

  constructor(private readonly options: JwksVerifierOptions) {
    this.provider = options.provider;
    this.jwks = options.clientIds.length > 0 ? createRemoteJWKSet(new URL(options.jwksUrl)) : null;
  }

  isConfigured(): boolean {
    return this.jwks !== null;
  }

  async verify(idToken: string, rawNonce?: string): Promise<VerifiedIdentity> {
    if (!this.jwks) {
      throw AppError.unavailable(
        'PROVIDER_NOT_CONFIGURED',
        `${this.provider === 'google' ? 'Google' : 'Apple'} sign-in is not available yet.`,
      );
    }
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(idToken, this.jwks, {
        issuer: this.options.issuers,
        audience: this.options.clientIds,
        algorithms: ['RS256', 'ES256'],
        clockTolerance: 30,
      }));
    } catch {
      throw AppError.unauthorized('PROVIDER_TOKEN_INVALID', 'We could not verify your sign-in. Please try again.');
    }

    if (this.options.nonceRequired || rawNonce || payload.nonce !== undefined) {
      const expected =
        rawNonce === undefined
          ? undefined
          : this.options.nonceMode === 'sha256'
            ? createHash('sha256').update(rawNonce).digest('hex')
            : rawNonce;
      if (!expected || payload.nonce !== expected) {
        throw AppError.unauthorized('PROVIDER_TOKEN_INVALID', 'Sign-in nonce mismatch. Please try again.');
      }
    }
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw AppError.unauthorized('PROVIDER_TOKEN_INVALID', 'The sign-in token is missing a subject.');
    }

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
    // Google: boolean; Apple: boolean or the string "true".
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    const name = typeof payload.name === 'string' ? payload.name : null;
    return { provider: this.provider, subject: payload.sub, email, emailVerified, name };
  }
}

export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
export const APPLE_ISSUERS = ['https://appleid.apple.com'];
