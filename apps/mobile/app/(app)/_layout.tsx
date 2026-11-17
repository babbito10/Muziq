import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/theme';

/** Bottom tabs for small screens. Only shipped modules get a tab; more arrive with each phase. */
export default function AppLayout() {
  const { status } = useAuth();
  if (status === 'anonymous') return <Redirect href="/(auth)/sign-in" />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.bgElevated, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
