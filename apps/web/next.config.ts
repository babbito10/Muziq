import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

/**
 * Single-container deployments (infrastructure/docker/allinone.Dockerfile) serve the API and the
 * admin console behind this app, on the same origin. These are build-time constants pointing at
 * localhost inside the container; unset in every other deployment.
 */
const BUNDLED_API_URL = process.env.BUNDLED_API_URL;
const BUNDLED_ADMIN_URL = process.env.BUNDLED_ADMIN_URL;

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // The monorepo root, so standalone output includes workspace packages.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  // Linting runs as its own pipeline step (`pnpm lint`) with the shared flat config.
  eslint: { ignoreDuringBuilds: true },
  // No next/image optimisation (artwork will be served pre-sized from the CDN), so no sharp.
  images: { unoptimized: true },
  async rewrites() {
    return [
      ...(BUNDLED_API_URL
        ? [
            { source: '/api/v1/:path*', destination: `${BUNDLED_API_URL}/api/v1/:path*` },
            { source: '/api/docs', destination: `${BUNDLED_API_URL}/api/docs` },
            { source: '/api/docs/:path*', destination: `${BUNDLED_API_URL}/api/docs/:path*` },
            { source: '/api/docs-json', destination: `${BUNDLED_API_URL}/api/docs-json` },
          ]
        : []),
      ...(BUNDLED_ADMIN_URL
        ? [
            { source: '/admin', destination: `${BUNDLED_ADMIN_URL}/admin` },
            { source: '/admin/:path*', destination: `${BUNDLED_ADMIN_URL}/admin/:path*` },
          ]
        : []),
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
