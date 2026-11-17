import { ROLE_DEFINITIONS } from '@musicverse/auth';
import { ScrollView, Text, View } from 'react-native';
import { Banner, Body, Heading } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { colors, radius, spacing } from '@/theme';

const COMING = [
  { phase: 2, title: 'Listen & release', body: 'Streaming, playlists, search and rights-checked uploads.' },
  { phase: 3, title: 'Discover & connect', body: 'Recommendations, follows, posts and communities.' },
  { phase: 4, title: 'Create with AI', body: 'Creator Studio and licensed AI music tools.' },
];

export default function Home() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing(5), gap: spacing(4) }}>
      {!user.emailVerified && <Banner tone="warning">Check {user.email} for a link to verify your email.</Banner>}
      <Text style={{ color: colors.primary, fontWeight: '600' }}>Welcome</Text>
      <Heading>{user.profile.displayName}</Heading>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) }}>
        {user.roles.map((role) => (
          <Text key={role} style={{ color: colors.text, backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
            {ROLE_DEFINITIONS[role].name}
          </Text>
        ))}
      </View>
      <Body muted>Coming to MusicVerse:</Body>
      {COMING.map((item) => (
        <View key={item.phase} style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing(4), gap: spacing(1) }}>
          <Text style={{ color: colors.textSubtle, fontSize: 12, fontWeight: '700' }}>PHASE {item.phase}</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{item.title}</Text>
          <Text style={{ color: colors.textMuted }}>{item.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
