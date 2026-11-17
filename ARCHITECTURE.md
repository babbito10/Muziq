# MusicVerse Architecture (summary)

The full design is in [`documentation/architecture/system-architecture.md`](documentation/architecture/system-architecture.md).
Decision records are in [`DECISIONS.md`](DECISIONS.md).

## Shape

- **Modular monolith API** (NestJS) with strict domain modules; slow work moves to Pub/Sub workers.
- **Thin clients**: Next.js web, Next.js admin console, Expo mobile app — all on the shared typed
  `@musicverse/api-client` and Zod schemas from `@musicverse/validation`.
- **PostgreSQL** (Prisma) is the system of record; **Redis** for rate limits and the authorisation
  cache; **GCS + Cloud CDN** for media (Phase 2); **Google Cloud Run** for compute.

```
 web (Next) ─┐                     ┌─ PostgreSQL (Cloud SQL, private IP)
 admin (Next)┼─ HTTPS ─▶ API ──────┼─ Redis (Memorystore)
 mobile (Expo)┘          (NestJS)  ├─ Secret Manager
                                   ├─ GCS + Cloud CDN (media, Phase 2)
                                   └─ Pub/Sub ─▶ workers (audio, AI, notifications)
```

## Repository structure

```
apps/
  api/          NestJS REST API · Prisma schema, migrations, seed · integration tests
  web/          Next.js consumer app · Playwright E2E tests
  admin/        Next.js administration console
  mobile/       Expo / React Native app (iOS + Android)
packages/
  types/        API contracts, error codes, role & permission keys
  validation/   Zod schemas shared by API and clients
  auth/         role → permission matrix and grant policy
  api-client/   typed HTTP client with single-flight token refresh
  ui/           design tokens (Tailwind v4) + accessible React components
  audio-player/ framework-agnostic queue engine and audio adapter contract
  shared-config/ tsconfig bases, ESLint flat config, Jest preset
infrastructure/
  docker/       Dockerfiles + docker-compose development stack
  terraform/    Google Cloud platform module + dev/staging/prod roots
  cloud/        deployment runbook
database/       pointers to schema/migrations/seed; future shared SQL and fixtures
documentation/  PRD, roadmap, architecture, ERD, API, security, deployment
scripts/        developer scripts
.github/workflows/ CI
```

## Request lifecycle (API)

`pino-http` (request id) → `helmet`/CORS → **rate limit** (Redis) → **CSRF** (cookie routes) →
**JWT auth** (+ Redis authz cache: session active, user active, current roles) →
**permissions** → Zod validation → controller → service (resource checks, audit in the same
transaction) → uniform error envelope.

## Identity model

One user, many roles. `listener` is implicit; `artist`, `producer`, `dj`, `business`, `educator`
are self-service capabilities (verified email required); `moderator`, `admin`, `super_admin`
are staff roles granted only through the admin console under the `canManageRole` policy. The
canonical matrix lives in `packages/auth` and is synced to the database by the seed.
