import { Inject, Injectable } from '@nestjs/common';
import type { ClientType } from '@musicverse/types';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG } from '../../../config/config.module';
import type { AppConfig } from '../../../config/env';
import { AppError } from '../../../common/errors/app-error';

const ISSUER = 'musicverse-api';
const ACCESS_AUDIENCE = 'musicverse';
const MFA_AUDIENCE = 'musicverse:mfa-challenge';
const MFA_TTL_SECONDS = 300;

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

export interface MfaClaims {
  userId: string;
  clientType: ClientType;
  challengeId: string;
}

/** Signs and verifies short-lived JWTs. Refresh tokens are opaque and handled by SessionService. */
@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.key = new TextEncoder().encode(config.auth.accessSecret);
  }

  get accessTtlSeconds(): number {
    return this.config.auth.accessTtlSeconds;
  }

  async signAccessToken(claims: AccessClaims): Promise<string> {
    return new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(ACCESS_AUDIENCE)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${this.config.auth.accessTtlSeconds}s`)
      .sign(this.key);
  }

  async verifyAccessToken(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: ACCESS_AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string')
        throw new Error('claims');
      return { userId: payload.sub, sessionId: payload.sid };
    } catch (error) {
      const expired = error instanceof joseErrors.JWTExpired;
      throw AppError.unauthorized(
        expired ? 'UNAUTHENTICATED' : 'INVALID_TOKEN',
        expired ? 'Your session has expired.' : 'Invalid access token.',
      );
    }
  }

  async signMfaToken(claims: Omit<MfaClaims, 'challengeId'>): Promise<string> {
    return new SignJWT({ ct: claims.clientType })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(MFA_AUDIENCE)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${MFA_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verifyMfaToken(token: string): Promise<MfaClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: MFA_AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string')
        throw new Error('claims');
      return {
        userId: payload.sub,
        clientType: payload.ct as ClientType,
        challengeId: payload.jti,
      };
    } catch {
      throw AppError.unauthorized(
        'INVALID_TOKEN',
        'Your sign-in challenge has expired. Please sign in again.',
      );
    }
  }
}
