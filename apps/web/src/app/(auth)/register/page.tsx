'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  const router = useRouter();
  return (
    <AuthCard
      title="Create your account"
      subtitle="Listen free. Add artist, producer or DJ tools whenever you're ready."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
        </>
      }
    >
      <RegisterForm onSuccess={() => router.push('/')} />
    </AuthCard>
  );
}
