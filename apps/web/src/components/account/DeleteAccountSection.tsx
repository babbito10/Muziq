'use client';

import { Alert, Button, Card, CardHeader, TextField } from '@musicverse/ui';
import { deleteAccountSchema } from '@musicverse/validation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useZodForm } from '@/lib/use-zod-form';

export function DeleteAccountSection() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const form = useZodForm(deleteAccountSchema, async (values) => {
    await api.users.deleteAccount(values);
    // Clears the refresh cookie; RequireAuth then sends the (now signed-out) visitor home.
    await logout().catch(() => undefined);
  });
  if (!user) return null;

  return (
    <Card className="border-danger/40">
      <CardHeader
        title="Delete account"
        description="Your account is deactivated immediately and permanently anonymised after 30 days."
      />
      {!open ? (
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete my account…
        </Button>
      ) : (
        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) =>
            form.handleSubmit(e, {
              confirm: confirmText,
              ...(user.hasPassword ? { password } : {}),
            })
          }
        >
          {form.formError && (
            <Alert tone="danger" className="sm:col-span-2">
              {form.formError}
            </Alert>
          )}
          {user.hasPassword && (
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={form.errors.password}
            />
          )}
          <TextField
            label='Type "DELETE" to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            error={form.errors.confirm}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="danger" loading={form.submitting}>
              Permanently delete
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
