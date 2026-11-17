import type { ErrorCode, ValidationIssue } from '@musicverse/types';

/**
 * Domain error with a stable machine-readable code. Thrown from services and mapped to the
 * uniform error envelope by `AllExceptionsFilter`.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: ValidationIssue[] | Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: ErrorCode, message: string, details?: AppError['details']) {
    return new AppError(400, code, message, details ?? null);
  }
  static unauthorized(code: ErrorCode = 'UNAUTHENTICATED', message = 'Authentication required.') {
    return new AppError(401, code, message);
  }
  static forbidden(
    message = 'You do not have permission to perform this action.',
    code: ErrorCode = 'FORBIDDEN',
  ) {
    return new AppError(403, code, message);
  }
  static notFound(message = 'Not found.') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(code: ErrorCode, message: string) {
    return new AppError(409, code, message);
  }
  static unavailable(code: ErrorCode, message: string) {
    return new AppError(503, code, message);
  }
}
