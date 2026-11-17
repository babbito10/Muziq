import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: colors.textMuted }]}>{children}</Text>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: spacing(1.5) }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, error ? { borderColor: colors.danger } : null]}
        {...props}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, loading, variant = 'primary', ...props }: PressableProps & { title: string; loading?: boolean; variant?: 'primary' | 'secondary' }) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!props.disabled || loading, busy: loading }}
      disabled={props.disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
        (pressed || props.disabled) && { opacity: 0.7 },
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.primaryContrast : colors.text} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? colors.primaryContrast : colors.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Banner({ tone, children }: { tone: 'danger' | 'warning' | 'success'; children: ReactNode }) {
  const color = colors[tone];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { borderColor: color }]}>
      <Text style={{ color: colors.text }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing(6), gap: spacing(4) },
  heading: { color: colors.text, fontSize: 28, fontWeight: '800' },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    color: colors.text,
    paddingHorizontal: spacing(3.5),
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 13 },
  button: { minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(5) },
  buttonText: { fontSize: 16, fontWeight: '700' },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: spacing(3), backgroundColor: colors.surface },
});
