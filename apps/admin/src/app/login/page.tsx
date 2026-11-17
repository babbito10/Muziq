'use client';

import { Alert, Button, Card, Logo, TextField } from '@musicverse/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { useAdminAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';

export default function AdminLoginPage() {
  const { login, completeMfa } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mfaToken) {
        await completeMfa(mfaToken, code);
        router.replace('/');
      } else {
        const result = await login(email.trim().toLowerCase(), password);
        if (result.mfaRequired) setMfaToken(result.mfaToken);
        else router.replace('/');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-2">
          <Logo withWordmark={false} />
          <h1 className="text-xl font-bold">MusicVerse Admin</h1>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {mfaToken ? (
            <TextField
              label="Authentication code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          ) : (
            <>
              <TextField
                label="Email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}
          <Button type="submit" loading={busy} fullWidth>
            {mfaToken ? 'Verify' : 'Sign in'}
          </Button>
          <p className="text-xs text-fg-subtle">
            Staff accounts only. All actions are audit-logged.
          </p>
        </form>
      </Card>
    </main>
  );
}
