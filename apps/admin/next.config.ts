import type { NextConfig } from 'next';

// The admin console loads no third-party scripts; keep the policy strict.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const config: NextConfig = {
  // Set to "/admin" when served behind the web app in a single-container deployment.
  basePath: process.env.ADMIN_BASE_PATH || undefined,
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  eslint: { ignoreDuringBuilds: true },
  // No next/image optimisation (artwork will be served pre-sized from the CDN), so no sharp.
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
