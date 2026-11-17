// Process supervisor for the single-container deployment (Render free tier, demos).
// 1. apply migrations + seed  2. start API (:4000), admin (:3001) and web (public $PORT)
// 3. if any process exits, stop the others and exit non-zero so the platform restarts us.
import { spawn, spawnSync } from 'node:child_process';

const env = process.env;
const publicPort = env.PORT ?? '3000';
const externalUrl = env.WEB_APP_URL ?? env.RENDER_EXTERNAL_URL ?? `http://localhost:${publicPort}`;
const shared = { ...env, PUBLIC_API_URL: '/api/v1' };

function step(label, cmd, args, cwd) {
  console.info(`[start] ${label}`);
  const result = spawnSync(cmd, args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[start] ${label} failed (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

step('database migrations', 'node_modules/.bin/prisma', ['migrate', 'deploy'], '/app/api');
step('seed (roles, optional admin)', 'node', ['dist/database/seed.js'], '/app/api');

const processes = [
  {
    name: 'api',
    cwd: '/app/api',
    args: ['dist/main.js'],
    // The web app's proxy forwards X-Forwarded-For unchanged; the platform load balancer appends the
    // real client address as the last entry, so trusting one hop yields the client IP.
    env: { ...shared, PORT: '4000', WEB_APP_URL: externalUrl, TRUST_PROXY: env.TRUST_PROXY ?? '1' },
  },
  {
    name: 'admin',
    cwd: '/app/admin',
    args: ['apps/admin/server.js'],
    env: { ...shared, PORT: '3001', HOSTNAME: '127.0.0.1' },
  },
  {
    name: 'web',
    cwd: '/app/web',
    args: ['apps/web/server.js'],
    env: { ...shared, PORT: publicPort, HOSTNAME: '0.0.0.0' },
  },
];

const children = processes.map((p) => {
  const child = spawn('node', p.args, { cwd: p.cwd, env: p.env, stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    console.error(`[start] ${p.name} exited (${signal ?? code}); shutting down`);
    shutdown(code || 1);
  });
  return child;
});

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 5000).unref();
}
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
