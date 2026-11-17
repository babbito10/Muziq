'use client';

import { Alert, Button, TextField } from '@musicverse/ui';
import { forgotPasswordSchema } from '@musicverse/validation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const form = useZodForm(forgotPasswordSchema, async (values) => {
    await api.auth.forgotPassword(values);
    setSent(true);
  });

  if (sent) {
    return (
      <Alert tone="success" title="Check your inbox">
        If an account exists for {email}, we have sent a link to reset your password. It expires in
        30 minutes.
      </Alert>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(e) => form.handleSubmit(e, { email })}
      className="flex flex-col gap-4"
    >
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={form.errors.email}
      />
      <Button type="submit" loading={form.submitting} fullWidth size="lg">
        Send reset link
      </Button>
    </form>
  );
}
