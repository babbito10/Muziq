'use client';

import { Alert, Button, Card, CardHeader, TextField } from '@musicverse/ui';
import { updateProfileSchema } from '@musicverse/validation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useZodForm } from '@/lib/use-zod-form';

export function ProfileSection() {
  const { user, setUser } = useAuth();
  const [values, setValues] = useState({
    displayName: user?.profile.displayName ?? '',
    username: user?.profile.username ?? '',
    bio: user?.profile.bio ?? '',
    countryCode: user?.profile.countryCode ?? '',
  });
  const [saved, setSaved] = useState(false);
  const form = useZodForm(updateProfileSchema, async (parsed) => {
    setUser(await api.users.updateProfile(parsed));
    setSaved(true);
  });
  if (!user) return null;

  const set = (key: keyof typeof values, value: string) => {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: value }));
  };

  return (
    <Card>
      <CardHeader title="Profile" description="How you appear to other people on MusicVerse." />
      <form
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) =>
          form.handleSubmit(e, {
            displayName: values.displayName,
            username: values.username.trim() === '' ? null : values.username,
            bio: values.bio.trim() === '' ? null : values.bio,
            countryCode: values.countryCode.trim() === '' ? null : values.countryCode,
          })
        }
      >
        {form.formError && <Alert tone="danger" className="sm:col-span-2">{form.formError}</Alert>}
        {saved && <Alert tone="success" className="sm:col-span-2">Profile saved.</Alert>}
        <TextField label="Display name" value={values.displayName} onChange={(e) => set('displayName', e.target.value)} error={form.errors.displayName} />
        <TextField label="Username" value={values.username} onChange={(e) => set('username', e.target.value)} error={form.errors.username} hint="Letters, numbers, dots and underscores." />
        <TextField label="Country" value={values.countryCode} maxLength={2} onChange={(e) => set('countryCode', e.target.value)} error={form.errors.countryCode} hint="2-letter code, e.g. KE" />
        <TextField label="Bio" value={values.bio} onChange={(e) => set('bio', e.target.value)} error={form.errors.bio} />
        <div className="sm:col-span-2">
          <Button type="submit" loading={form.submitting}>Save profile</Button>
        </div>
      </form>
    </Card>
  );
}
