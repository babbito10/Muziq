import { registerSchema } from '@musicverse/validation';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Body, Field, Heading, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { errorMessage, validate } from '@/lib/errors';
import { colors, spacing } from '@/theme';

export default function SignUp() {
  const { register } = useAuth();
  const [values, setValues] = useState({ displayName: '', email: '', password: '' });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setFormError(null);
    const checked = validate(registerSchema, {
      ...values,
      acceptTerms: accepted,
      clientType: 'mobile',
    });
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    setBusy(true);
    try {
      await register({
        email: checked.data.email,
        password: checked.data.password,
        displayName: checked.data.displayName,
      });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing(6), gap: spacing(4) }}
          keyboardShouldPersistTaps="handled"
        >
          <Heading>Create your account</Heading>
          <Body muted>
            Listen free. Add artist, producer or DJ tools whenever you&apos;re ready.
          </Body>
          {formError ? <Banner tone="danger">{formError}</Banner> : null}
          <Field
            label="Display name"
            value={values.displayName}
            onChangeText={(t) => setValues((v) => ({ ...v, displayName: t }))}
            error={errors.displayName}
          />
          <Field
            label="Email"
            value={values.email}
            onChangeText={(t) => setValues((v) => ({ ...v, email: t }))}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={errors.email}
          />
          <Field
            label="Password"
            value={values.password}
            onChangeText={(t) => setValues((v) => ({ ...v, password: t }))}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.password}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            onPress={() => setAccepted((a) => !a)}
            style={{ flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start' }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: colors.primary,
                backgroundColor: accepted ? colors.primary : 'transparent',
              }}
            />
            <Text style={{ color: colors.textMuted, flex: 1 }}>
              I agree to the Terms and Privacy Policy, and I will only upload music I own or am
              licensed to use.
            </Text>
          </Pressable>
          {errors.acceptTerms ? (
            <Text style={{ color: colors.danger }}>{errors.acceptTerms}</Text>
          ) : null}
          <PrimaryButton title="Create account" loading={busy} onPress={submit} />
          <Link
            href="/(auth)/sign-in"
            style={{ color: colors.primary, textAlign: 'center', padding: spacing(2) }}
          >
            <Text>Already have an account? Sign in</Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
