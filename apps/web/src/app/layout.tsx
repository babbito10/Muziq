import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { DEFAULT_API_URL, RUNTIME_CONFIG_ID, serialiseRuntimeConfig } from '@/lib/runtime-config';
import { themeBootstrapScript } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'MusicVerse', template: '%s · MusicVerse' },
  description: 'One world. Every sound. Endless possibilities.',
};

export const viewport: Viewport = {
  themeColor: '#0a0f1e',
  colorScheme: 'dark light',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render per request so configuration comes from the runtime environment, not the build.
  await connection();
  const runtimeConfig = serialiseRuntimeConfig({ apiUrl: process.env.PUBLIC_API_URL ?? DEFAULT_API_URL });
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <script id={RUNTIME_CONFIG_ID} type="application/json" dangerouslySetInnerHTML={{ __html: runtimeConfig }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
