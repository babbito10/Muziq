import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ROLE_KEYS,
  type AdminUserDetail,
  type AdminUserSummary,
  type AuditLogEntry,
  type Paginated,
  type RoleKey,
} from '@musicverse/types';
import {
  adminGrantRoleSchema,
  adminListUsersQuerySchema,
  adminSuspendSchema,
  auditLogQuerySchema,
  type AdminGrantRoleInput,
  type AdminListUsersQuery,
  type AdminSuspendInput,
  type AuditLogQuery,
} from '@musicverse/validation';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentAuth, RequirePermissions } from '../../common/decorators/auth.decorators';
import { requestMeta } from '../../common/http/request-meta';
import { ApiZodBody, ApiZodQuery, zodPipe } from '../../common/validation/zod';
import type { AuthContext } from '../auth/auth.types';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @RequirePermissions('admin:users.read')
  @ApiOperation({ summary: 'List users (cursor paginated, filter by status/role/search)' })
  @ApiZodQuery(adminListUsersQuerySchema)
  listUsers(@Query(zodPipe(adminListUsersQuerySchema)) query: AdminListUsersQuery): Promise<Paginated<AdminUserSummary>> {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  @RequirePermissions('admin:users.read')
  @ApiOperation({ summary: 'User detail' })
  getUser(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminUserDetail> {
    return this.admin.getUser(id);
  }

  @Post('users/:id/roles')
  @HttpCode(200)
  @RequirePermissions('admin:roles.manage')
  @ApiOperation({ summary: 'Grant a role' })
  @ApiZodBody(adminGrantRoleSchema)
  grantRole(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(zodPipe(adminGrantRoleSchema)) body: AdminGrantRoleInput,
    @Req() req: Request,
  ): Promise<AdminUserDetail> {
    return this.admin.changeRole(auth, id, body.role, 'grant', requestMeta(req));
  }

  @Delete('users/:id/roles/:role')
  @RequirePermissions('admin:roles.manage')
  @ApiOperation({ summary: 'Revoke a role' })
  revokeRole(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('role', zodPipe(z.enum(ROLE_KEYS))) role: RoleKey,
    @Req() req: Request,
  ): Promise<AdminUserDetail> {
    return this.admin.changeRole(auth, id, role, 'revoke', requestMeta(req));
  }

  @Post('users/:id/suspend')
  @HttpCode(200)
  @RequirePermissions('admin:users.manage')
  @ApiOperation({ summary: 'Suspend a user and revoke all sessions' })
  @ApiZodBody(adminSuspendSchema)
  suspend(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(zodPipe(adminSuspendSchema)) body: AdminSuspendInput,
    @Req() req: Request,
  ): Promise<AdminUserDetail> {
    return this.admin.suspend(auth, id, body.reason, requestMeta(req));
  }

  @Post('users/:id/reinstate')
  @HttpCode(200)
  @RequirePermissions('admin:users.manage')
  @ApiOperation({ summary: 'Reinstate a suspended user' })
  reinstate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<AdminUserDetail> {
    return this.admin.reinstate(auth, id, requestMeta(req));
  }

  @Get('audit-logs')
  @RequirePermissions('admin:audit.read')
  @ApiOperation({ summary: 'Audit log (cursor paginated)' })
  @ApiZodQuery(auditLogQuerySchema)
  auditLogs(@Query(zodPipe(auditLogQuerySchema)) query: AuditLogQuery): Promise<Paginated<AuditLogEntry>> {
    return this.admin.auditLogs(query);
  }
}
