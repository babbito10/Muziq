import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaController } from './mfa.controller';
import { createIdTokenVerifiers, ID_TOKEN_VERIFIERS } from './providers/oauth-providers';
import { AuthzCacheService } from './services/authz-cache.service';
import { MfaService } from './services/mfa.service';
import { PasswordService } from './services/password.service';
import { RolesService } from './services/roles.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { VerificationTokenService } from './services/verification-token.service';

@Global()
@Module({
  controllers: [AuthController, MfaController],
  providers: [
    AuthService,
    AuthzCacheService,
    MfaService,
    PasswordService,
    RolesService,
    SessionService,
    TokenService,
    VerificationTokenService,
    {
      provide: ID_TOKEN_VERIFIERS,
      inject: [APP_CONFIG],
      useFactory: (c: AppConfig) => createIdTokenVerifiers(c),
    },
  ],
  exports: [
    AuthService,
    AuthzCacheService,
    PasswordService,
    RolesService,
    SessionService,
    TokenService,
    MfaService,
  ],
})
export class AuthModule {}
