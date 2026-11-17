import { loginSchema, mfaVerifySchema } from '@musicverse/validation';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Body, Field, Heading, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { errorMessage, validate } from '@/lib/errors';
import { colors, spacing } from '@/theme';

export default function SignIn() {
  const { login, completeMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setFormError(null);
    const checked = mfaToken
      ? validate(mfaVerifySchema, { mfaToken, code, clientType: 'mobile' })
      : validate(loginSchema, { email, password, clientType: 'mobile' });
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    setBusy(true);
    try {
      if (mfaToken) await completeMfa(mfaToken, code);
      else {
        const result = await login(email, password);
        if (result.mfaRequired) setMfaToken(result.mfaToken);
      }
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing(6), gap: spacing(4) }} keyboardShouldPersistTaps="handled">
          <Heading>{mfaToken ? 'Two-step verification' : 'Welcome back'}</Heading>
          <Body muted>{mfaToken ? 'Enter the 6-digit code from your authenticator app.' : 'Sign in to MusicVerse.'}</Body>
          {formError ? <Banner tone="danger">{formError}</Banner> : null}
          {mfaToken ? (
            <Field label="Authentication code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoFocus error={errors.code} />
          ) : (
            <>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" error={errors.email} />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" error={errors.password} />
            </>
          )}
          <PrimaryButton title={mfaToken ? 'Verify' : 'Sign in'} loading={busy} onPress={submit} />
          {!mfaToken && (
            <Link href="/(auth)/sign-up" style={{ color: colors.primary, textAlign: 'center', padding: spacing(2) }}>
              <Text>New here? Create an account</Text>
            </Link>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
