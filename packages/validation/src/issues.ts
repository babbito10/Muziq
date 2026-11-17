import type { ValidationIssue } from '@musicverse/types';
import type { z } from 'zod';

/** Convert a ZodError into the API's `ValidationIssue[]` shape. */
export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/** Map issues to `{ field: firstMessage }` for form display. */
export function fieldErrors(issues: readonly ValidationIssue[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path || '_form';
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
