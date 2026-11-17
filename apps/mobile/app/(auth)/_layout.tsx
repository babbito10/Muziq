import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/theme';

export default function AuthLayout() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
