import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@musicverse/types';
import type { Request } from 'express';
import type { AuthContext } from '../../modules/auth/auth.types';
import { AppError } from '../errors/app-error';

export const IS_PUBLIC = 'mv:isPublic';
export const REQUIRED_PERMISSIONS = 'mv:requiredPermissions';
export const CSRF_PROTECTED = 'mv:csrfProtected';

/** Opt a route out of authentication (all routes are authenticated by default). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Require every listed permission (derived from the caller's roles). */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

/** Route reads a credential from a cookie; require the anti-CSRF header when a cookie is present. */
export const CsrfProtected = () => SetMetadata(CSRF_PROTECTED, true);

/** Inject the authenticated principal. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.auth) throw AppError.unauthorized();
    return request.auth;
  },
);
