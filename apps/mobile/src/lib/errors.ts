import { isApiError } from '@musicverse/api-client';
import { fieldErrors, toValidationIssues } from '@musicverse/validation';
import type { z } from 'zod';

export function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : 'Something went wrong. Please try again.';
}

/** Validate with a shared schema; returns field errors or the parsed value. */
export function validate<S extends z.ZodType>(schema: S, values: unknown):
  | { ok: true; data: z.output<S> }
  | { ok: false; errors: Record<string, string> } {
  const result = schema.safeParse(values);
  return result.success ? { ok: true, data: result.data } : { ok: false, errors: fieldErrors(toValidationIssues(result.error)) };
}
