import type { SessionSummary } from '@musicverse/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Banner, Body, Heading, PrimaryButton } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme';

export default function Account() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSessions(await api.auth.sessions());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing(5), gap: spacing(4) }}
    >
      <Heading>Account</Heading>
      <Body muted>{user.email}</Body>
      <Body>Two-step verification: {user.mfaEnabled ? 'On' : 'Off'}</Body>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing(2) }}>
        Signed-in devices
      </Text>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {!sessions && !error ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading sessions" />
      ) : null}
      {sessions?.map((s) => (
        <View
          key={s.id}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: spacing(3),
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {s.clientType}
            {s.current ? ' · this device' : ''}
          </Text>
          <Text style={{ color: colors.textSubtle }}>
            Last active {new Date(s.lastUsedAt).toLocaleString()}
          </Text>
        </View>
      ))}
      <Body muted>
        Manage your profile, creator capabilities and security on the web at your MusicVerse account
        page.
      </Body>
      <PrimaryButton
        title="Sign out"
        variant="secondary"
        loading={signingOut}
        onPress={async () => {
          setSigningOut(true);
          await logout();
        }}
      />
    </ScrollView>
  );
}
