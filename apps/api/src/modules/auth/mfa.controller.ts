import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { TotpSetupResponse } from '@musicverse/types';
import {
  totpConfirmSchema,
  totpDisableSchema,
  type TotpConfirmInput,
  type TotpDisableInput,
} from '@musicverse/validation';
import type { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/auth.decorators';
import { requestMeta } from '../../common/http/request-meta';
import { ApiZodBody, zodPipe } from '../../common/validation/zod';
import type { AuthContext } from './auth.types';
import { MfaService } from './services/mfa.service';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth/mfa/totp')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Post('setup')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Begin TOTP enrolment; returns an otpauth:// URI for authenticator apps',
  })
  setup(@CurrentAuth() auth: AuthContext): Promise<TotpSetupResponse> {
    return this.mfa.beginSetup(auth.userId);
  }

  @Post('confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm TOTP enrolment with a code' })
  @ApiZodBody(totpConfirmSchema)
  async confirm(
    @CurrentAuth() auth: AuthContext,
    @Body(zodPipe(totpConfirmSchema)) body: TotpConfirmInput,
    @Req() req: Request,
  ): Promise<{ enabled: true }> {
    await this.mfa.confirmSetup(auth.userId, body.code, requestMeta(req));
    return { enabled: true };
  }

  @Post('disable')
  @HttpCode(200)
  @ApiOperation({ summary: 'Disable TOTP (requires password, if set, and a current code)' })
  @ApiZodBody(totpDisableSchema)
  async disable(
    @CurrentAuth() auth: AuthContext,
    @Body(zodPipe(totpDisableSchema)) body: TotpDisableInput,
    @Req() req: Request,
  ): Promise<{ enabled: false }> {
    await this.mfa.disable(auth.userId, body, requestMeta(req));
    return { enabled: false };
  }
}
