import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CsrfGuard } from './common/guards/csrf.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { APP_CONFIG, ConfigModule } from './config/config.module';
import type { AppConfig } from './config/env';
import { MailModule } from './infrastructure/mail/mail.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisThrottlerStorage } from './infrastructure/rate-limit/redis-throttler.storage';
import { RedisModule } from './infrastructure/redis/redis.module';
import { RedisService } from './infrastructure/redis/redis.service';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

const REQUEST_ID = /^[A-Za-z0-9._-]{8,100}$/;

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const incoming = req.headers['x-request-id'];
            const id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
            censor: '[redacted]',
          },
          autoLogging: { ignore: (req: IncomingMessage) => (req.url ?? '').startsWith('/api/v1/health') },
          customProps: (req: IncomingMessage) => ({ userId: (req as { auth?: { userId: string } }).auth?.userId }),
          transport:
            config.env === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG, RedisService],
      useFactory: (config: AppConfig, redis: RedisService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        storage: new RedisThrottlerStorage(redis),
        skipIf: () => !config.rateLimitEnabled,
      }),
    }),
    PrismaModule,
    RedisModule,
    MailModule,
    AuditModule,
    AuthModule,
    UsersModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    // Order matters: rate limit → CSRF → authentication → authorisation.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
