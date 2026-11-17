# MusicVerse — System Architecture

Status: v1.0 · Applies from Phase 1 · See also [`/ARCHITECTURE.md`](../../ARCHITECTURE.md) (summary)
and [`/DECISIONS.md`](../../DECISIONS.md) (decision records).

## 1. Architectural style

**Modular monolith API + independently deployable workers + thin clients.**

- One NestJS API service organised into strictly bounded domain modules (identity, catalogue,
  streaming, social, AI, commerce, governance…). Modules communicate through exported services
  and domain events, never by reaching into each other's tables.
- Expensive or slow work (audio processing, AI jobs, notifications fan-out, analytics roll-ups)
  runs in **worker services** consuming **Pub/Sub** topics. Workers share the same codebase
  (`apps/api`, separate entrypoints) so domain logic is not duplicated.
- Clients (web, admin, mobile) are stateless consumers of the versioned REST API through the
  shared typed `@musicverse/api-client`.

A modular monolith keeps Phase 1–3 delivery fast and transactional consistency simple, while the
module boundaries + event contracts let us extract services (e.g. streaming edge, AI gateway)
later without a rewrite. (ADR-002)

## 2. Context diagram

```
                ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 Users ───────▶ │  Web (Next)  │   │ Admin (Next) │   │ Mobile (Expo)│
                └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
                       │ HTTPS (same-site /api rewrite)       │ HTTPS + bearer
                       ▼                  ▼                  ▼
               ┌──────────────────────────────────────────────────────┐
               │             API  (NestJS, Cloud Run)                 │
               │  auth · users · artists · catalogue · streaming ·    │
               │  discovery · social · ai · creator · commerce · admin│
               └───┬───────────┬──────────────┬───────────────┬───────┘
                   │           │              │               │ publish
          Prisma   ▼   ioredis ▼     signed   ▼               ▼
            ┌───────────┐ ┌────────┐  URLs ┌──────────┐  ┌─────────┐
            │ Cloud SQL │ │ Redis  │       │  GCS     │  │ Pub/Sub │
            │ Postgres  │ │(Memory-│       │ private  │  └────┬────┘
            └───────────┘ │ store) │       │ buckets  │       │ push/pull
                          └────────┘       └────┬─────┘       ▼
                                                │      ┌──────────────┐
                                     Cloud CDN ◀┘      │ Workers      │
                                    (signed cookies/   │ audio · ai · │
                                     URLs for media)   │ notify · etl │
                                                       └──────────────┘
 External adapters: SMTP provider · Google/Apple identity · payment providers ·
                    AI providers · malware scanner · fingerprinting/rights services
```

## 3. Monorepo layout

| Path | Purpose |
|---|---|
| `apps/api` | NestJS REST API (`/api/v1/*`), Prisma schema & migrations, OpenAPI at `/api/docs` |
| `apps/web` | Next.js (App Router) consumer web app |
| `apps/admin` | Next.js administration console (separate deployable, separate domain, stricter CSP) |
| `apps/mobile` | Expo / React Native app (iOS + Android) |
| `packages/types` | Shared TypeScript domain types and error contracts |
| `packages/validation` | Zod schemas shared by API (request validation) and clients (form validation) |
| `packages/auth` | Roles, permissions, role→permission matrix, `can()` helpers |
| `packages/api-client` | Typed fetch client for all API endpoints, token refresh handling |
| `packages/ui` | Accessible React (DOM) component library + design tokens (Tailwind) |
| `packages/audio-player` | Framework-agnostic player/queue engine (shuffle, repeat, history) |
| `packages/shared-config` | tsconfig bases, ESLint config, Jest presets |
| `database/` | Seed data and migration documentation (Prisma migrations live with the API) |
| `infrastructure/` | Dockerfiles, docker-compose, Terraform for GCP |
| `documentation/` | PRD, architecture, database, API, security, deployment docs |

Tooling: **pnpm workspaces** + **Turborepo** task graph (`build` depends on `^build`), **tsup**
for package builds (dual ESM/CJS + `.d.ts`). (ADR-001)

## 4. API internal structure

```
apps/api/src
├── main.ts                     bootstrap: helmet, cookies, CORS, versioning, Swagger, shutdown hooks
├── app.module.ts
├── config/                     zod-validated environment (fail fast on boot)
├── common/
│   ├── errors/                 AppError, error codes, global exception filter
│   ├── validation/             ZodBody/ZodQuery DTO helpers + ZodValidationPipe
│   ├── decorators/             @Public, @RequirePermissions, @CurrentUser, @CsrfProtected
│   ├── guards/                 JwtAuthGuard, PermissionsGuard, CsrfGuard
│   ├── pagination/             cursor pagination helpers
│   └── logging/                pino logger, request-id
├── infrastructure/
│   ├── prisma/                 PrismaService (connection lifecycle, health)
│   ├── redis/                  RedisService (ioredis)
│   ├── rate-limit/             Redis-backed throttler storage
│   └── mail/                   MailService → SmtpMailTransport | ConsoleMailTransport (dev)
└── modules/
    ├── health/                 liveness & readiness (db + redis)
    ├── audit/                  AuditService (append-only audit_logs)
    ├── auth/                   register, login, refresh, logout, verify email, reset password,
    │                           OAuth (Google/Apple ID-token adapters), MFA (TOTP), sessions
    ├── users/                  /users/me, preferences, capabilities, account deletion
    └── admin/                  user administration, role grants, suspension, audit-log viewer
```

Future modules follow the same shape: `controller → service → repository (Prisma)`, DTO schemas
in `@musicverse/validation`, permissions in `@musicverse/auth`.

### Cross-cutting request pipeline

1. `pino-http` assigns/propagates `x-request-id`, logs request/response (redacting auth headers & cookies).
2. `helmet` security headers; CORS allow-list from config.
3. **Rate limiting** (`@nestjs/throttler` with Redis storage; strict buckets on auth endpoints).
4. `JwtAuthGuard` (global; `@Public()` opt-out) → `PermissionsGuard` (`@RequirePermissions`).
5. `CsrfGuard` on cookie-authenticated endpoints (refresh/logout).
6. `ZodValidationPipe` validates body/query/params.
7. Controller → service. Resource-level ownership checks happen in services.
8. Global exception filter → uniform error envelope.

## 5. Authentication model

- **Access token**: JWT (HS256 in Phase 1; RS256/KMS planned for multi-service), 15 min, carries
  `sub`, `sid` (session id), `roles`. Sent as `Authorization: Bearer`.
- **Refresh token**: 256-bit random opaque token, stored **hashed** (SHA-256) in `sessions`;
  **rotated on every use**; reuse of a rotated token revokes the whole session family
  (token-theft detection).
  - Web/admin: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` cookie.
  - Mobile: returned in body, stored in the OS keychain (`expo-secure-store`).
- **Session** row per device: user agent, IP (truncated), created/last-used, revoked flag.
- **Email verification / password reset**: single-use random tokens, stored hashed, short expiry.
  Password reset revokes all sessions.
- **MFA**: TOTP (RFC 6238); login returns an `mfaRequired` challenge token (5-minute JWT, distinct
  audience) that must be exchanged with a valid code. Secrets encrypted at rest (AES-256-GCM).
- **Social sign-in**: client obtains an ID token from Google/Apple SDK; API verifies signature
  against the provider JWKS, issuer, audience and expiry, then links or creates the account.
  Disabled (HTTP 503 `PROVIDER_NOT_CONFIGURED`) unless the client IDs are configured.

## 6. Authorisation model

RBAC + resource ownership:

- **Roles** (`listener`, `artist`, `producer`, `dj`, `business`, `educator`, `moderator`,
  `admin`, `super_admin`) map to **permissions** (`catalogue:upload`, `admin:users.read`, …).
  The canonical matrix lives in `@musicverse/auth` and is synced to the `roles`/`permissions`
  tables by the seed.
- Capability roles (`artist`, `producer`, `dj`, `business`, `educator`) are self-service.
  Staff roles (`moderator`, `admin`, `super_admin`) can only be granted by an admin and are
  audit-logged.
- Resource checks (e.g. "may edit *this* track") are enforced in services using ownership/
  membership relations — never by role alone.

## 7. Media & audio pipeline (Phase 2 design)

```
client ──POST /creator/uploads──▶ API: authz + metadata + rights declaration
       ◀── V4 signed PUT URL (private "ingest" bucket, 15 min, content-type & size bound)
client ──PUT──▶ GCS ingest bucket ──object.finalize──▶ Pub/Sub `media.uploaded`
worker(audio): malware scan → ffprobe validate → transcode (AAC 64/128/256, Opus, HLS segments)
             → loudness analysis → waveform peaks → technical metadata → fingerprint/rights checks
             → writes `audio_versions`, status `in_review` → Pub/Sub `media.processed`
moderator approves → status `approved` → artist publishes → `published`
playback: API checks entitlement → returns CDN signed URL/cookie (short TTL) to "delivery" bucket
```

No audio is processed inside API request handlers. Original masters never leave the private
bucket; only transcoded renditions are CDN-delivered.

## 8. Eventing

Topics (Pub/Sub): `media.uploaded`, `media.processed`, `catalogue.published`, `social.activity`,
`notifications.dispatch`, `ai.job.requested`, `ai.job.completed`, `payments.webhook.received`,
`analytics.listening`. Messages are versioned JSON envelopes `{ id, type, version, occurredAt,
data }`; consumers are idempotent (dedupe by message id). A transactional **outbox** table
(Phase 2) guarantees events are published iff the DB transaction commits.

## 9. Data stores

| Store | Use |
|---|---|
| PostgreSQL (Cloud SQL) | System of record. Prisma ORM, migrations in Git. |
| Redis (Memorystore) | Rate limits, short-lived caches, queue de-dup, presence, trending counters |
| GCS | Private ingest bucket, processed delivery bucket (CDN origin), public static artwork bucket |
| Search (Phase 2–3) | Postgres full-text + `pg_trgm` first; OpenSearch/Vertex AI Search when needed (ADR-008) |
| Analytics (Phase 3+) | Listening events streamed to BigQuery for charts/recommendations |

## 10. Clients

- **Web** (Next.js App Router, React 19, Tailwind v4). Calls the API via a same-origin rewrite
  (`/api/v1/* → API_URL`) so refresh cookies are first-party and CORS is avoided. Access token
  is kept in memory only.
- **Admin** — separate Next.js app/domain; only users with `admin:*` permissions can sign in.
- **Mobile** — Expo Router; tokens in SecureStore; same API client.
- **Audio** — `@musicverse/audio-player` holds queue/shuffle/repeat state; platform adapters wrap
  `HTMLAudioElement` (web) and `expo-audio` (mobile).

## 11. Observability

Structured JSON logs (pino) → Cloud Logging, with `requestId`, `userId`, `sessionId`. Health:
`/api/v1/health/live` and `/api/v1/health/ready` (DB + Redis). Metrics/traces via OpenTelemetry
→ Cloud Monitoring/Trace (Phase 2). Alerting on error rate, latency, auth anomalies.

## 12. Environments

`local` (docker-compose or native services) → `development` → `staging` → `production`, each a
separate GCP project with its own Terraform workspace/vars. Configuration exclusively via
environment variables validated at boot; secrets from Secret Manager in cloud.
