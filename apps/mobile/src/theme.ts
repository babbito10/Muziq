/** Mobile design tokens mirroring @musicverse/ui (dark-first). */
export const colors = {
  bg: '#0a0f1e',
  bgElevated: '#0f1629',
  surface: '#151b2e',
  surfaceRaised: '#1c2339',
  border: '#2a3350',
  text: '#eef1f8',
  textMuted: '#a3acc4',
  textSubtle: '#8690ab',
  primary: '#2dd4bf',
  primaryContrast: '#042f2e',
  accent: '#a78bfa',
  danger: '#f87171',
  warning: '#fbbf24',
  success: '#4ade80',
} as const;

export const radius = { md: 12, lg: 16, pill: 999 } as const;
export const spacing = (n: number) => n * 4;
