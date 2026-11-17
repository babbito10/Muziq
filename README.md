# MusicVerse

**One world. Every sound. Endless possibilities.**

MusicVerse is an integrated music ecosystem for listeners, artists, producers, DJs, music
businesses and educators — authorised streaming, discovery, creation, social, monetisation and
learning, on web, Android and iOS. One account covers every role.

> **Status: Phase 1 (Foundation) complete.** Accounts, security, roles, the admin console, the
> design system and the delivery pipeline are built and tested. Streaming, catalogue and the other
> modules arrive in later phases — see [TASKS.md](TASKS.md) and the
> [roadmap](documentation/product-requirements/roadmap.md).

## What's in the box

| App | Stack | Local URL |
|---|---|---|
| API | NestJS · Prisma · PostgreSQL · Redis | http://localhost:4000/api/v1 — docs at `/api/docs` |
| Web | Next.js 15 · React 19 · Tailwind v4 | http://localhost:3000 |
| Admin | Next.js (staff only) | http://localhost:3001 |
| Mobile | Expo SDK 54 · React Native | Expo Go / simulator |

Shared packages: `types`, `validation` (Zod), `auth` (RBAC), `api-client`, `ui`, `audio-player`,
`shared-config`. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Quick start (Docker)

```bash
corepack enable
pnpm install
pnpm docker:up
```

This starts Postgres, Redis, Mailpit, runs migrations + seed, then the API, web and admin apps.
All emails are captured at http://localhost:8025. A development super admin is seeded
(`admin@musicverse.local` / `change-this-dev-password` — override with `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`).

## Quick start (native services)

Requires PostgreSQL 16 and Redis 7 running locally, and a `musicverse` role/database
(`createuser -d musicverse -P` with password `musicverse`, then `createdb -O musicverse musicverse`).

```bash
corepack enable
./scripts/setup-local.sh     # env files with generated secrets, install, build packages, migrate, seed
pnpm dev                     # API on :4000, web on :3000
pnpm --filter @musicverse/admin dev    # admin on :3001
pnpm --filter @musicverse/mobile dev   # Expo
```

With `MAIL_TRANSPORT=console` (the default in `apps/api/.env`), emails are **not sent** — the API
log prints them, including verification links.

## Deploy a preview to Render (fastest public link)

[`render.yaml`](render.yaml) deploys everything as one Docker service plus a PostgreSQL database and
a Key Value (Redis) instance, all on free plans:

1. Sign in at [render.com](https://render.com) with GitHub and allow access to this repository.
2. **New → Blueprint**, choose this repository and the branch to deploy.
3. Enter `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (≥ 10 characters) for your first admin.
4. **Apply.** The first build takes several minutes. Your link is `https://<service>.onrender.com`;
   the admin console is at `/admin` and API docs at `/api/docs`.

Free-tier limits: the service sleeps when idle (first request ≈ 1 minute), the free database
expires after 30 days, and email is off (`MAIL_TRANSPORT=none`) until you add SMTP settings —
until then users cannot verify their email (needed for creator capabilities).

## Testing

```bash
pnpm lint && pnpm typecheck
pnpm test        # unit + API integration (needs Postgres + Redis; uses database musicverse_test)
pnpm test:e2e    # Playwright against the real stack (needs Postgres, Redis, Mailpit; run `pnpm build` first)
```

Create the test databases once: `createdb -O musicverse musicverse_test` and
`createdb -O musicverse musicverse_e2e`.

## Configuration

Every variable is documented in [.env.example](.env.example). Configuration is validated at
startup; the API refuses to boot with missing secrets, the development mail transport or insecure
cookies in production.

## Integrations status

| Integration | Status |
|---|---|
| Email (SMTP) | Implemented; needs a provider account for staging/production |
| Google / Apple sign-in | Implemented (ID-token verification); disabled until client IDs are configured |
| Google Cloud | Terraform written; not applied (no project/credentials yet) |
| Payments, AI providers, fingerprinting | Not started (Phases 4–5); will be built only against approved provider APIs |

## Documentation

[documentation/](documentation/README.md) · [DECISIONS.md](DECISIONS.md) ·
[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [CHANGELOG.md](CHANGELOG.md)
