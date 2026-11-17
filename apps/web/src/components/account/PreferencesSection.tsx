'use client';

import type { ThemePreference, UserPreferences } from '@musicverse/types';
import { Alert, Card, CardHeader, Checkbox } from '@musicverse/ui';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Match system' },
];

export function PreferencesSection() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!user) return null;
  const prefs = user.preferences;

  async function update(patch: Partial<Omit<UserPreferences, 'emailNotifications'>> & { emailNotifications?: Partial<UserPreferences['emailNotifications']> }) {
    setError(null);
    setPending(true);
    try {
      setUser(await api.users.updatePreferences(patch));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Preferences" />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <fieldset className="mb-6" disabled={pending}>
        <legend className="mb-2 text-sm font-medium text-fg">Theme</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <label
              key={t.value}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${prefs.theme === t.value ? 'border-primary bg-primary/15 text-fg' : 'border-border text-fg-muted hover:bg-surface-hover'}`}
            >
              <input
                type="radio"
                name="theme"
                value={t.value}
                className="sr-only"
                checked={prefs.theme === t.value}
                onChange={() => update({ theme: t.value })}
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3" disabled={pending}>
        <legend className="mb-2 text-sm font-medium text-fg">Content and email</legend>
        <Checkbox label="Show explicit content" checked={prefs.explicitContent} onChange={(e) => update({ explicitContent: e.target.checked })} />
        <Checkbox label="Product news and tips" checked={prefs.emailNotifications.product} onChange={(e) => update({ emailNotifications: { product: e.target.checked } })} />
        <Checkbox label="Social activity (follows, comments)" checked={prefs.emailNotifications.social} onChange={(e) => update({ emailNotifications: { social: e.target.checked } })} />
        <Checkbox label="Security alerts (recommended)" checked={prefs.emailNotifications.security} onChange={(e) => update({ emailNotifications: { security: e.target.checked } })} />
      </fieldset>
    </Card>
  );
}
