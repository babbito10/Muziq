'use client';

import { Alert, Button, TextField } from '@musicverse/ui';
import { PASSWORD_MIN_LENGTH, resetPasswordSchema } from '@musicverse/validation';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const form = useZodForm(resetPasswordSchema, async (values) => {
    await api.auth.resetPassword(values);
    setDone(true);
  });

  if (!token) {
    return (
      <Alert tone="danger" title="This link is incomplete">
        Open the link from your email again, or <Link className="underline" href="/forgot-password">request a new one</Link>.
      </Alert>
    );
  }
  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title="Password updated">
          For your security, you have been signed out on all devices.
        </Alert>
        <Link href="/login" className="text-center font-semibold text-primary hover:underline">
          Sign in with your new password
        </Link>
      </div>
    );
  }
  return (
    <form noValidate onSubmit={(e) => form.handleSubmit(e, { token, password })} className="flex flex-col gap-4">
      {(form.formError || form.errors.token) && (
        <Alert tone="danger">{form.formError ?? form.errors.token}</Alert>
      )}
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={form.errors.password}
      />
      <Button type="submit" loading={form.submitting} fullWidth size="lg">
        Update password
      </Button>
    </form>
  );
}
