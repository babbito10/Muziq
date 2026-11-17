'use client';

import { Alert, Button } from '@musicverse/ui';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  if (!user || user.emailVerified) return null;

  return (
    <Alert
      tone="warning"
      title="Verify your email address"
      action={
        state === 'sent' ? undefined : (
          <Button
            size="sm"
            variant="secondary"
            loading={state === 'sending'}
            onClick={async () => {
              setState('sending');
              try {
                await api.auth.resendVerification();
                setState('sent');
              } catch (error) {
                setMessage(errorMessage(error));
                setState('error');
              }
            }}
          >
            Resend email
          </Button>
        )
      }
    >
      {state === 'sent'
        ? `We sent a new link to ${user.email}.`
        : state === 'error'
          ? message
          : `We sent a link to ${user.email}. Verifying unlocks artist, producer and other creator tools.`}
    </Alert>
  );
}
