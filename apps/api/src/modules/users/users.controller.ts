import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAPABILITY_ROLES, type CapabilityRole, type CurrentUser } from '@musicverse/types';
import {
  capabilitySchema,
  deleteAccountSchema,
  updatePreferencesSchema,
  updateProfileSchema,
  type CapabilityInput,
  type DeleteAccountInput,
  type UpdatePreferencesInput,
  type UpdateProfileInput,
} from '@musicverse/validation';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentAuth } from '../../common/decorators/auth.decorators';
import { requestMeta } from '../../common/http/request-meta';
import { ApiZodBody, zodPipe } from '../../common/validation/zod';
import type { AuthContext } from '../auth/auth.types';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Current user, profile, preferences, roles and permissions' })
  me(@CurrentAuth() auth: AuthContext): Promise<CurrentUser> {
    return this.users.me(auth.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update profile fields' })
  @ApiZodBody(updateProfileSchema)
  updateProfile(
    @CurrentAuth() auth: AuthContext,
    @Body(zodPipe(updateProfileSchema)) body: UpdateProfileInput,
    @Req() req: Request,
  ): Promise<CurrentUser> {
    return this.users.updateProfile(auth.userId, body, requestMeta(req));
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update preferences (theme, explicit content, email notifications)' })
  @ApiZodBody(updatePreferencesSchema)
  updatePreferences(
    @CurrentAuth() auth: AuthContext,
    @Body(zodPipe(updatePreferencesSchema)) body: UpdatePreferencesInput,
  ): Promise<CurrentUser> {
    return this.users.updatePreferences(auth.userId, body);
  }

  @Post('capabilities')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add a capability role (artist, producer, dj, business, educator)' })
  @ApiZodBody(capabilitySchema)
  addCapability(
    @CurrentAuth() auth: AuthContext,
    @Body(zodPipe(capabilitySchema)) body: CapabilityInput,
    @Req() req: Request,
  ): Promise<CurrentUser> {
    return this.users.addCapability(auth.userId, body.role, requestMeta(req));
  }

  @Delete('capabilities/:role')
  @ApiOperation({ summary: 'Remove a capability role' })
  removeCapability(
    @CurrentAuth() auth: AuthContext,
    @Param('role', zodPipe(z.enum(CAPABILITY_ROLES))) role: CapabilityRole,
    @Req() req: Request,
  ): Promise<CurrentUser> {
    return this.users.removeCapability(auth.userId, role, requestMeta(req));
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete account (deactivated now, anonymised after 30 days)' })
  @ApiZodBody(deleteAccountSchema)
  async deleteAccount(
    @CurrentAuth() auth: AuthContext,
    @Body(zodPipe(deleteAccountSchema)) body: DeleteAccountInput,
    @Req() req: Request,
  ): Promise<void> {
    await this.users.scheduleDeletion(auth.userId, body, requestMeta(req));
  }
}
