import { isApiError } from '@musicverse/api-client';
import { fieldErrors } from '@musicverse/validation';

/** Human-readable message for any error thrown by the API client. */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (isApiError(error)) return error.message;
  return fallback;
}

/** Field errors from a VALIDATION_FAILED response, keyed by field path. */
export function apiFieldErrors(error: unknown): Record<string, string> {
  return isApiError(error, 'VALIDATION_FAILED') ? fieldErrors(error.issues) : {};
}
