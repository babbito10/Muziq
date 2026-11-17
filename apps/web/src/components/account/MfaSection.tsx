'use client';

import type { TotpSetupResponse } from '@musicverse/types';
import { Alert, Badge, Button, Card, CardHeader, TextField } from '@musicverse/ui';
import { totpConfirmSchema, totpDisableSchema } from '@musicverse/validation';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';
import { useZodForm } from '@/lib/use-zod-form';

export function MfaSection() {
  const { user, reload } = useAuth();
  const [setup, setSetup] = useState<TotpSetupResponse | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!setup) return setQr(null);
    // Rendered locally — the secret never leaves the browser for a third-party QR service.
    QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 192 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [setup]);

  const confirm = useZodForm(totpConfirmSchema, async (values) => {
    await api.auth.totpConfirm(values);
    setSetup(null);
    setCode('');
    await reload();
  });
  const disable = useZodForm(totpDisableSchema, async (values) => {
    await api.auth.totpDisable(values);
    setCode('');
    setPassword('');
    await reload();
  });
  if (!user) return null;

  return (
    <Card>
      <CardHeader
        title="Two-step verification"
        description="Protect your account with codes from an authenticator app."
        action={user.mfaEnabled ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}
      />
      {user.mfaEnabled ? (
        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) =>
            disable.handleSubmit(e, { code, ...(user.hasPassword ? { password } : {}) })
          }
        >
          {disable.formError && (
            <Alert tone="danger" className="sm:col-span-2">
              {disable.formError}
            </Alert>
          )}
          {user.hasPassword && (
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={disable.errors.password}
            />
          )}
          <TextField
            label="Current code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            error={disable.errors.code}
          />
          <div className="sm:col-span-2">
            <Button type="submit" variant="danger" loading={disable.submitting}>
              Turn off two-step verification
            </Button>
          </div>
        </form>
      ) : setup ? (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-2">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR code to add MusicVerse to your authenticator app"
                className="h-48 w-48 rounded-xl bg-white p-2"
              />
            ) : (
              <div
                className="h-48 w-48 animate-pulse rounded-xl bg-surface-raised"
                aria-hidden="true"
              />
            )}
          </div>
          <form
            noValidate
            className="flex flex-1 flex-col gap-4"
            onSubmit={(e) => confirm.handleSubmit(e, { code })}
          >
            <p className="text-sm text-fg-muted">
              Scan the QR code with an authenticator app, or enter this key manually:
            </p>
            <code className="break-all rounded-lg bg-bg-elevated px-3 py-2 font-mono text-sm text-fg">
              {setup.secret}
            </code>
            {confirm.formError && <Alert tone="danger">{confirm.formError}</Alert>}
            <TextField
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              error={confirm.errors.code}
            />
            <div className="flex gap-2">
              <Button type="submit" loading={confirm.submitting}>
                Turn on
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSetup(null);
                  setCode('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {startError && <Alert tone="danger">{startError}</Alert>}
          <div>
            <Button
              loading={starting}
              onClick={async () => {
                setStartError(null);
                setStarting(true);
                try {
                  setSetup(await api.auth.totpSetup());
                } catch (e) {
                  setStartError(errorMessage(e));
                } finally {
                  setStarting(false);
                }
              }}
            >
              Set up two-step verification
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
