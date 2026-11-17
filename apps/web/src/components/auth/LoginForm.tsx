'use client';

import { Alert, Button, TextField } from '@musicverse/ui';
import { loginSchema, mfaVerifySchema } from '@musicverse/validation';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useZodForm } from '@/lib/use-zod-form';

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { login, completeMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const credentials = useZodForm(loginSchema, async (values) => {
    const result = await login({ email: values.email, password: values.password });
    if (result.mfaRequired) setMfaToken(result.mfaToken);
    else onSuccess();
  });

  const mfa = useZodForm(mfaVerifySchema, async (values) => {
    await completeMfa(values.mfaToken, values.code);
    onSuccess();
  });

  if (mfaToken) {
    return (
      <form noValidate onSubmit={(e) => mfa.handleSubmit(e, { mfaToken, code })} className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">Enter the 6-digit code from your authenticator app.</p>
        {mfa.formError && <Alert tone="danger">{mfa.formError}</Alert>}
        <TextField
          label="Authentication code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          error={mfa.errors.code}
        />
        <Button type="submit" loading={mfa.submitting} fullWidth size="lg">
          Verify
        </Button>
        <Button variant="ghost" onClick={() => { setMfaToken(null); setCode(''); }}>
          Use a different account
        </Button>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={(e) => credentials.handleSubmit(e, { email, password })} className="flex flex-col gap-4">
      {credentials.formError && <Alert tone="danger">{credentials.formError}</Alert>}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={credentials.errors.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={credentials.errors.password}
      />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" loading={credentials.submitting} fullWidth size="lg">
        Sign in
      </Button>
    </form>
  );
}
