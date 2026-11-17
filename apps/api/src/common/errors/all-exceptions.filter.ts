import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody, ErrorCode } from '@musicverse/types';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppError } from './app-error';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

interface Mapped {
  status: number;
  code: ErrorCode;
  message: string;
  details: ApiErrorBody['error']['details'];
}

/** Maps every thrown value to the uniform `{ error: {...} }` envelope. Never leaks internals. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const mapped = this.map(exception);

    if (mapped.status >= 500) {
      this.logger.error(
        { err: exception, path: request.originalUrl, requestId: request.id },
        'Unhandled exception',
      );
    }

    // Errors raised before the request-id middleware ran (e.g. body parsing) still get an id.
    let requestId = typeof request.id === 'string' ? request.id : null;
    if (!requestId) {
      requestId = randomUUID();
      response.setHeader('x-request-id', requestId);
    }
    const body: ApiErrorBody = {
      error: { code: mapped.code, message: mapped.message, details: mapped.details, requestId },
    };
    if (mapped.status === 429 && !response.getHeader('retry-after'))
      response.setHeader('retry-after', '60');
    response.status(mapped.status).json(body);
  }

  private map(exception: unknown): Mapped {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }
    if (exception instanceof ThrottlerException) {
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down and try again shortly.',
        details: null,
      };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: 409,
          code: 'CONFLICT',
          message: 'A record with these details already exists.',
          details: null,
        };
      }
      if (exception.code === 'P2025') {
        return { status: 404, code: 'NOT_FOUND', message: 'Not found.', details: null };
      }
    }
    // Errors raised by body-parser before reaching controllers.
    const bodyParserType = (exception as { type?: string } | null)?.type;
    if (bodyParserType === 'entity.too.large') {
      return {
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body is too large.',
        details: null,
      };
    }
    if (bodyParserType === 'entity.parse.failed') {
      return {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: 'Request body is not valid JSON.',
        details: null,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED'),
        message: status === 404 ? 'Route not found.' : exception.message,
        details: null,
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      details: null,
    };
  }
}
