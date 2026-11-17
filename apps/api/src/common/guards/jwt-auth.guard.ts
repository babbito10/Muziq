import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC } from '../decorators/auth.decorators';
import { AppError } from '../errors/app-error';
import { AuthzCacheService } from '../../modules/auth/services/authz-cache.service';
import { TokenService } from '../../modules/auth/services/token.service';

/** Global guard: every route requires a valid bearer token unless marked `@Public()`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly authz: AuthzCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const match = typeof header === 'string' ? /^Bearer ([A-Za-z0-9._-]+)$/.exec(header) : null;
    if (!match) throw AppError.unauthorized('UNAUTHENTICATED', 'Sign in to continue.');

    const claims = await this.tokens.verifyAccessToken(match[1]!);
    const auth = await this.authz.resolve(claims.userId, claims.sessionId);
    if (!auth)
      throw AppError.unauthorized(
        'UNAUTHENTICATED',
        'Your session has ended. Please sign in again.',
      );
    request.auth = auth;
    return true;
  }
}
