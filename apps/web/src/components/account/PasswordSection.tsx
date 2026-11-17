'use client';

import { Alert, Button, Card, CardHeader, TextField } from '@musicverse/ui';
import { changePasswordSchema } from '@musicverse/validation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useZodForm } from '@/lib/use-zod-form';

export function PasswordSection() {
  const { user } = useAuth();
  const [values, setValues] = useState({ currentPassword: '', newPassword: '' });
  const [done, setDone] = useState(false);
  const form = useZodForm(changePasswordSchema, async (parsed) => {
    await api.auth.changePassword(parsed);
    setValues({ currentPassword: '', newPassword: '' });
    setDone(true);
  });
  if (!user?.hasPassword) return null;

  return (
    <Card>
      <CardHeader
        title="Password"
        description="Changing your password signs you out everywhere else."
      />
      <form
        noValidate
        onSubmit={(e) => form.handleSubmit(e, values)}
        className="grid gap-4 sm:grid-cols-2"
      >
        {form.formError && (
          <Alert tone="danger" className="sm:col-span-2">
            {form.formError}
          </Alert>
        )}
        {done && (
          <Alert tone="success" className="sm:col-span-2">
            Password changed. Other sessions were signed out.
          </Alert>
        )}
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={(e) => {
            setDone(false);
            setValues((v) => ({ ...v, currentPassword: e.target.value }));
          }}
          error={form.errors.currentPassword}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(e) => {
            setDone(false);
            setValues((v) => ({ ...v, newPassword: e.target.value }));
          }}
          error={form.errors.newPassword}
        />
        <div className="sm:col-span-2">
          <Button type="submit" loading={form.submitting}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}
