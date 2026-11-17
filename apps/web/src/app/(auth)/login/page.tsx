'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';
import { safeNext } from '@/lib/redirect';

function LoginContent() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to MusicVerse."
      footer={
        <>
          New here?{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link>
        </>
      }
    >
      <LoginForm onSuccess={() => router.push(next)} />
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
