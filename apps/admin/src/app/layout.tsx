import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { AdminAuthProvider } from '@/lib/auth-context';
import { DEFAULT_API_URL, RUNTIME_CONFIG_ID, serialiseRuntimeConfig } from '@/lib/runtime-config';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'MusicVerse Admin', template: '%s · MusicVerse Admin' },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  const runtimeConfig = serialiseRuntimeConfig({ apiUrl: process.env.PUBLIC_API_URL ?? DEFAULT_API_URL });
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script id={RUNTIME_CONFIG_ID} type="application/json" dangerouslySetInnerHTML={{ __html: runtimeConfig }} />
      </head>
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
