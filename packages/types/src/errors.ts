/**
 * Closed set of machine-readable error codes returned by the MusicVerse API.
 * Clients branch on `code`; `message` is human-readable and may change.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'INVALID_TOKEN',
  'TOKEN_REUSED',
  'EMAIL_NOT_VERIFIED',
  'EMAIL_ALREADY_REGISTERED',
  'USERNAME_TAKEN',
  'ACCOUNT_SUSPENDED',
  'MFA_REQUIRED',
  'INVALID_MFA_CODE',
  'MFA_ALREADY_ENABLED',
  'MFA_NOT_ENABLED',
  'CSRF_CHECK_FAILED',
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_TOKEN_INVALID',
  'ROLE_NOT_ASSIGNABLE',
  'PAYLOAD_TOO_LARGE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ValidationIssue {
  /** Dot-separated path to the offending field, e.g. `profile.username`. */
  path: string;
  message: string;
  code?: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details: ValidationIssue[] | Record<string, unknown> | null;
    requestId: string | null;
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}
