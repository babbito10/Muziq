'use client';

import { CapabilitiesSection } from '@/components/account/CapabilitiesSection';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { EmailVerificationBanner } from '@/components/account/EmailVerificationBanner';
import { MfaSection } from '@/components/account/MfaSection';
import { PasswordSection } from '@/components/account/PasswordSection';
import { PreferencesSection } from '@/components/account/PreferencesSection';
import { ProfileSection } from '@/components/account/ProfileSection';
import { SessionsSection } from '@/components/account/SessionsSection';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useAuth } from '@/lib/auth-context';

export function AccountView() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  );
}

function AccountContent() {
  const { user } = useAuth();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Account</h1>
        <p className="mt-1 text-fg-muted">{user?.email}</p>
      </header>
      <EmailVerificationBanner />
      <ProfileSection />
      <section id="capabilities" aria-label="Capabilities">
        <CapabilitiesSection />
      </section>
      <PreferencesSection />
      <h2 className="mt-4 font-display text-xl font-semibold">Security</h2>
      <PasswordSection />
      <MfaSection />
      <SessionsSection />
      <DeleteAccountSection />
    </div>
  );
}
