'use client';

import { Alert, buttonClasses, LoadingRegion, Spinner } from '@musicverse/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';

function VerifyContent() {
  const token = useSearchParams().get('token');
  const { status: authStatus, reload } = useAuth();
  const [state, setState] = useState<'verifying' | 'verified' | 'error'>(token ? 'verifying' : 'error');
  const [message, setMessage] = useState<string>('This verification link is incomplete.');
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single-use: guard against React strict-mode double effects.
    if (!token || started.current) return;
    started.current = true;
    api.auth
      .verifyEmail(token)
      .then(() => setState('verified'))
      .catch((error) => {
        setMessage(errorMessage(error));
        setState('error');
      });
  }, [token]);

  useEffect(() => {
    if (state === 'verified' && authStatus === 'authenticated') void reload();
  }, [state, authStatus, reload]);

  return (
    <AuthCard title="Verify your email">
      {state === 'verifying' && (
        <LoadingRegion label="Verifying your email">
          <div className="flex items-center gap-3 text-fg-muted">
            <Spinner /> Verifying…
          </div>
        </LoadingRegion>
      )}
      {state === 'verified' && (
        <div className="flex flex-col gap-4">
          <Alert tone="success" title="Email verified">Creator capabilities are now unlocked for your account.</Alert>
          <Link href="/" className={buttonClasses('primary', 'md', true)}>Continue</Link>
        </div>
      )}
      {state === 'error' && (
        <Alert tone="danger" title="We couldn't verify your email">
          {message} You can request a new link from your account page.
        </Alert>
      )}
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
