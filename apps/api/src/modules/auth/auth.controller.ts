import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  AuthSuccessResponse,
  AuthTokens,
  ClientType,
  LoginResponse,
  OAuthProvider,
  ProvidersResponse,
  SessionSummary,
} from '@musicverse/types';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  mfaVerifySchema,
  oauthSignInSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type ChangePasswordInput,
  type ResetPasswordInput,
} from '@musicverse/validation';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/env';
import { CsrfProtected, CurrentAuth, Public } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { requestMeta } from '../../common/http/request-meta';
import { ApiZodBody, zodPipe } from '../../common/validation/zod';
import { AuthService, type IssuedSession } from './auth.service';
import type { AuthContext } from './auth.types';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie';
import { SessionService } from './services/session.service';

/** Strict per-IP limits for credential endpoints (in addition to the global limit). */
const STRICT = { default: { limit: 10, ttl: 60_000 } };
const VERY_STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Deliver the refresh token: HttpOnly cookie for browsers, response body for mobile. */
  private deliver(issued: IssuedSession, res: Response): AuthSuccessResponse {
    if (issued.clientType === 'mobile')
      return { ...issued.response, refreshToken: issued.refreshToken };
    setRefreshCookie(res, this.config, issued.clientType, issued.refreshToken);
    return issued.response;
  }

  private deliverLogin(result: LoginResponse | IssuedSession, res: Response): LoginResponse {
    return 'response' in result ? this.deliver(result, res) : result;
  }

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'Sign-in methods available in this environment' })
  providers(): ProvidersResponse {
    return this.auth.providers();
  }

  @Public()
  @Post('register')
  @Throttle(VERY_STRICT)
  @ApiOperation({ summary: 'Create an account (listener role) and send a verification email' })
  @ApiZodBody(registerSchema)
  async register(
    @Body(zodPipe(registerSchema)) body: z.output<typeof registerSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSuccessResponse> {
    return this.deliver(await this.auth.register(body, requestMeta(req)), res);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Sign in with email and password (may return an MFA challenge)' })
  @ApiZodBody(loginSchema)
  async login(
    @Body(zodPipe(loginSchema)) body: z.output<typeof loginSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.deliverLogin(await this.auth.login(body, requestMeta(req)), res);
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Complete an MFA challenge with a TOTP code' })
  @ApiZodBody(mfaVerifySchema)
  async verifyMfa(
    @Body(zodPipe(mfaVerifySchema)) body: z.output<typeof mfaVerifySchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSuccessResponse> {
    return this.deliver(await this.auth.completeMfa(body, requestMeta(req)), res);
  }

  @Public()
  @Post('oauth/:provider')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Sign in with a Google or Apple ID token (503 when not configured)' })
  @ApiZodBody(oauthSignInSchema)
  async oauth(
    @Param('provider', zodPipe(z.enum(['google', 'apple']))) provider: OAuthProvider,
    @Body(zodPipe(oauthSignInSchema)) body: z.output<typeof oauthSignInSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.deliverLogin(await this.auth.oauthSignIn(provider, body, requestMeta(req)), res);
  }

  @Public()
  @CsrfProtected()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  @ApiZodBody(refreshSchema)
  async refresh(
    @Body(zodPipe(refreshSchema)) body: z.output<typeof refreshSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokens> {
    const clientType: ClientType = body.clientType;
    const token = clientType === 'mobile' ? body.refreshToken : readRefreshCookie(req, clientType);
    if (!token)
      throw AppError.unauthorized('INVALID_TOKEN', 'You are signed out. Please sign in again.');
    try {
      const result = await this.auth.refresh(token, clientType, requestMeta(req));
      if (clientType === 'mobile') return result;
      setRefreshCookie(res, this.config, clientType, result.refreshToken);
      return { accessToken: result.accessToken, expiresIn: result.expiresIn };
    } catch (error) {
      if (clientType !== 'mobile') clearRefreshCookie(res, this.config, clientType);
      throw error;
    }
  }

  @Public()
  @CsrfProtected()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiZodBody(logoutSchema)
  async logout(
    @Body(zodPipe(logoutSchema)) body: z.output<typeof logoutSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const meta = requestMeta(req);
    const tokens = [
      body.refreshToken,
      readRefreshCookie(req, 'web'),
      readRefreshCookie(req, 'admin'),
    ];
    // Only clear the cookie(s) actually presented, so signing out of one app keeps the other.
    for (const clientType of ['web', 'admin'] as const) {
      if (readRefreshCookie(req, clientType)) clearRefreshCookie(res, this.config, clientType);
    }
    for (const token of tokens) await this.auth.logout(token, meta);
  }

  @Public()
  @Post('email/verify')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Verify an email address with the emailed token' })
  @ApiZodBody(verifyEmailSchema)
  async verifyEmail(
    @Body(zodPipe(verifyEmailSchema)) body: z.output<typeof verifyEmailSchema>,
    @Req() req: Request,
  ): Promise<{ verified: true }> {
    await this.auth.verifyEmail(body.token, requestMeta(req));
    return { verified: true };
  }

  @ApiBearerAuth()
  @Post('email/resend')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resend the verification email' })
  resendVerification(@CurrentAuth() auth: AuthContext): Promise<{ sent: boolean }> {
    return this.auth.resendVerification(auth.userId);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(202)
  @Throttle(VERY_STRICT)
  @ApiOperation({ summary: 'Request a password reset email (always 202)' })
  @ApiZodBody(forgotPasswordSchema)
  async forgotPassword(
    @Body(zodPipe(forgotPasswordSchema)) body: z.output<typeof forgotPasswordSchema>,
    @Req() req: Request,
  ): Promise<{ accepted: true }> {
    await this.auth.forgotPassword(body.email, requestMeta(req));
    return { accepted: true };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Set a new password with a reset token (signs out all sessions)' })
  @ApiZodBody(resetPasswordSchema)
  async resetPassword(
    @Body(zodPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Req() req: Request,
  ): Promise<{ reset: true }> {
    await this.auth.resetPassword(body, requestMeta(req));
    return { reset: true };
  }

  @ApiBearerAuth()
  @Post('password/change')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Change password (signs out other sessions)' })
  @ApiZodBody(changePasswordSchema)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body(zodPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() req: Request,
  ): Promise<{ changed: true }> {
    await this.auth.changePassword(auth.userId, auth.sessionId, body, requestMeta(req));
    return { changed: true };
  }

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions for the current user' })
  listSessions(@CurrentAuth() auth: AuthContext): Promise<SessionSummary[]> {
    return this.sessions.listActive(auth.userId, auth.sessionId);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out one of your sessions' })
  async revokeSession(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.revokeOwnSession(auth.userId, id, requestMeta(req));
  }
}
