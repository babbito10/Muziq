import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REFRESH_COOKIE } from '../../modules/auth/auth.types';
import { CSRF_PROTECTED } from '../decorators/auth.decorators';
import { AppError } from '../errors/app-error';

export const CSRF_HEADER = 'x-csrf-protection';

/**
 * Cookie-authenticated endpoints (refresh, logout) require a custom header when a refresh cookie
 * is present. Browsers cannot attach custom headers cross-site without a CORS preflight, which our
 * allow-list rejects; combined with SameSite=Strict cookies this blocks CSRF.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const protectedRoute = this.reflector.getAllAndOverride<boolean>(CSRF_PROTECTED, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!protectedRoute) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const cookies = (request.cookies ?? {}) as Record<string, string | undefined>;
    const hasCookie = Object.values(REFRESH_COOKIE).some((name) => !!cookies[name]);
    if (hasCookie && request.headers[CSRF_HEADER] !== '1') {
      throw AppError.forbidden('Missing CSRF protection header.', 'CSRF_CHECK_FAILED');
    }
    return true;
  }
}
