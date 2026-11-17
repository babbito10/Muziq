'use client';

import { Alert, Button, Checkbox, TextField } from '@musicverse/ui';
import { PASSWORD_MIN_LENGTH, registerSchema } from '@musicverse/validation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useZodForm } from '@/lib/use-zod-form';

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { register } = useAuth();
  const [values, setValues] = useState({
    displayName: '',
    email: '',
    password: '',
    acceptTerms: false,
  });
  const form = useZodForm(registerSchema, async (parsed) => {
    await register({
      email: parsed.email,
      password: parsed.password,
      displayName: parsed.displayName,
      acceptTerms: true,
    });
    onSuccess();
  });

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <form noValidate onSubmit={(e) => form.handleSubmit(e, values)} className="flex flex-col gap-4">
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      <TextField
        label="Display name"
        name="displayName"
        autoComplete="nickname"
        required
        value={values.displayName}
        onChange={(e) => set('displayName', e.target.value)}
        error={form.errors.displayName}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={values.email}
        onChange={(e) => set('email', e.target.value)}
        error={form.errors.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase works well.`}
        value={values.password}
        onChange={(e) => set('password', e.target.value)}
        error={form.errors.password}
      />
      <Checkbox
        label={
          <>
            I agree to the MusicVerse Terms of Service and Privacy Policy, and I will only upload
            music I own or am licensed to use.
          </>
        }
        checked={values.acceptTerms}
        onChange={(e) => set('acceptTerms', e.target.checked)}
        error={form.errors.acceptTerms}
      />
      <Button type="submit" loading={form.submitting} fullWidth size="lg">
        Create account
      </Button>
    </form>
  );
}
