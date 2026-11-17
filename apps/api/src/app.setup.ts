import { type INestApplication, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { CSRF_HEADER } from './common/guards/csrf.guard';
import type { AppConfig } from './config/env';

/**
 * Apply the HTTP pipeline. Shared by `main.ts` and the integration tests so tests exercise the
 * same middleware, prefixes and error handling as production.
 */
export function configureApp(app: NestExpressApplication, config: AppConfig): INestApplication {
  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet({ contentSecurityPolicy: config.swaggerEnabled ? false : undefined }));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization', 'x-request-id', 'idempotency-key', CSRF_HEADER],
    exposedHeaders: ['x-request-id', 'retry-after'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  const filter = new AllExceptionsFilter();
  app.useGlobalFilters(filter);
  // Errors raised by Express middleware (e.g. malformed JSON) bypass Nest filters; format them too.
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    filter.catch(err, { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as never);
  });
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('MusicVerse API')
        .setDescription('MusicVerse REST API v1. Errors use the envelope `{ error: { code, message, details, requestId } }`.')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
  }
  return app;
}
