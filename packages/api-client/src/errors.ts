import { isApiErrorBody, type ErrorCode, type ValidationIssue } from '@musicverse/types';

/** Error thrown for any non-2xx API response or network failure. */
export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly status: number;
  readonly details: ValidationIssue[] | Record<string, unknown> | null;
  readonly requestId: string | null;

  constructor(params: {
    code: ErrorCode | 'NETWORK_ERROR';
    status: number;
    message: string;
    details?: ValidationIssue[] | Record<string, unknown> | null;
    requestId?: string | null;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details ?? null;
    this.requestId = params.requestId ?? null;
  }

  /** Validation issues, when the error is `VALIDATION_FAILED`. */
  get issues(): ValidationIssue[] {
    return Array.isArray(this.details) ? this.details : [];
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON error bodies (e.g. proxies) fall through to a generic error.
    }
    if (isApiErrorBody(body)) {
      return new ApiError({ status: response.status, ...body.error });
    }
    return new ApiError({
      code: response.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR',
      status: response.status,
      message: `Request failed with status ${response.status}`,
      requestId: response.headers.get('x-request-id'),
    });
  }
}

export function isApiError(error: unknown, code?: ApiError['code']): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
