'use client';

import { fieldErrors, toValidationIssues } from '@musicverse/validation';
import { type FormEvent, useCallback, useState } from 'react';
import type { z } from 'zod';
import { apiFieldErrors, errorMessage } from './errors';

/**
 * Minimal form helper: validates with a shared Zod schema (the same one the API uses), maps API
 * validation errors back onto fields and exposes submission state.
 */
export function useZodForm<S extends z.ZodType>(
  schema: S,
  onValid: (values: z.output<S>) => Promise<void>,
) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>, values: unknown) => {
      event.preventDefault();
      setFormError(null);
      const parsed = schema.safeParse(values);
      if (!parsed.success) {
        setErrors(fieldErrors(toValidationIssues(parsed.error)));
        return;
      }
      setErrors({});
      setSubmitting(true);
      try {
        await onValid(parsed.data);
      } catch (error) {
        const fields = apiFieldErrors(error);
        if (Object.keys(fields).length > 0) setErrors(fields);
        else setFormError(errorMessage(error));
      } finally {
        setSubmitting(false);
      }
    },
    [schema, onValid],
  );

  return { errors, formError, setFormError, submitting, handleSubmit };
}
