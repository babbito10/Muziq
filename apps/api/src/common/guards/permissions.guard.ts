import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey } from '@musicverse/types';
import type { Request } from 'express';
import { REQUIRED_PERMISSIONS } from '../decorators/auth.decorators';
import { AppError } from '../errors/app-error';

/** Global guard (runs after JwtAuthGuard) enforcing `@RequirePermissions(...)`. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { auth } = context.switchToHttp().getRequest<Request>();
    if (!auth) throw AppError.unauthorized();
    const granted = new Set(auth.permissions);
    if (!required.every((p) => granted.has(p))) throw AppError.forbidden();
    return true;
  }
}
