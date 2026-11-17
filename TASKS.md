# MusicVerse — Implementation Checklist

Legend: `[x]` done and verified by automated tests or a recorded manual check · `[ ]` not done ·
`[~]` partially done (see note). Phase plan: [`documentation/product-requirements/roadmap.md`](documentation/product-requirements/roadmap.md).

## Phase 1 — Foundation

### 1.0 Planning
- [x] Product requirements document
- [x] System architecture document
- [x] Database entity relationship design (all domains; Phase 1 implemented)
- [x] API architecture
- [x] Security & rights management plan
- [x] Cloud infrastructure plan
- [x] Detailed implementation roadmap
- [x] Initial repository structure

### 1.1 Monorepo
- [x] pnpm workspaces + Turborepo task graph
- [x] Shared tsconfig / ESLint flat config / Jest preset / Prettier
- [x] Root scripts: build, lint, typecheck, test, format, db:*, docker:*

### 1.2 Shared packages (all build to ESM + CJS + types, all tested)
- [x] `types` — error codes, role/permission keys, API contracts
- [x] `validation` — Zod schemas for every Phase 1 request
- [x] `auth` — role → permission matrix, `canManageRole` policy
- [x] `api-client` — typed client, single-flight refresh, cookie and body refresh modes
- [x] `ui` — dark-first tokens + light theme, accessible components, server-safe class helpers
- [x] `audio-player` — queue engine (shuffle, repeat, history), adapter contract

### 1.3 Database
- [x] Prisma schema: users, profiles, roles, permissions, user_roles, sessions, verification tokens, OAuth accounts, MFA factors, audit logs
- [x] Migrations (incl. raw-SQL integrity constraints and append-only audit trigger)
- [x] Idempotent seed (role sync + optional first super admin)
- [x] Schema-drift check in CI

### 1.4 API foundation
- [x] Validated configuration (fails fast; production guards)
- [x] Structured logging with request IDs and header redaction
- [x] Uniform error envelope (incl. body-parser errors, 404s)
- [x] Redis-backed rate limiting with per-route limits
- [x] Health: liveness + readiness (DB, Redis)
- [x] OpenAPI at `/api/docs` (+ `/api/docs-json`)
- [x] Cursor pagination helpers

### 1.5 Identity & access
- [x] Registration, login (uniform failures, timing-equalised), logout
- [x] Refresh rotation, reuse detection, CSRF header guard, per-client cookies
- [x] Email verification (send, verify, resend)
- [x] Password forgot / reset (revokes sessions) / change
- [x] Session listing and revocation
- [x] TOTP MFA: enrol, confirm, login challenge, replay protection, attempt limit, disable
- [x] Google & Apple ID-token verification (JWKS) — **implemented, disabled until client IDs are configured**
- [x] RBAC guards + immediate revocation via authz cache
- [x] Capability roles (artist, producer, DJ, business, educator) — verified email required
- [x] Preferences; profile with unique usernames
- [x] Account deletion + scheduled anonymisation job
- [x] Admin: user list/search/filter, detail, role grant/revoke, suspend/reinstate, audit log
- [x] Audit logging of all security-relevant events

### 1.6 Web
- [x] App shell (desktop sidebar, mobile bottom nav, skip link); unbuilt modules shown as disabled "Soon"
- [x] Sign in (+ MFA step), register, verify email, forgot/reset password
- [x] Account: profile, preferences/theme, capabilities, password, MFA with QR, sessions, delete
- [x] Loading, empty and error states; accessible forms
- [x] Component tests + Playwright journeys 1 (listener registers) and 2 (artist registers)

### 1.7 Admin console
- [x] Staff-only sign-in (+ MFA), users, user detail, roles, suspension, audit log
- [x] Component tests (permission enforcement is tested at the API)

### 1.8 Mobile
- [x] Expo Router app: sign in (+ MFA), sign up, home, account (sessions, sign out)
- [x] Refresh token in OS keychain (expo-secure-store); access token in memory
- [x] Unit tests; Metro bundle export verified for iOS and Android
- [ ] Screen-level tests with jest-expo + React Native Testing Library
- [ ] Run on a physical device / simulator (not possible in the build sandbox)

### 1.9 DevOps
- [x] API and Next.js Dockerfiles (non-root, production deps only)
- [x] docker-compose stack (Postgres, Redis, Mailpit, migrate job, API, web, admin) — verified healthy end to end
- [x] GitHub Actions CI: quality, audit, API integration, E2E, Docker builds, Terraform
- [x] Terraform platform module + dev/staging/prod roots (formatted)
- [~] `terraform validate` — runs in CI; could not run in the build sandbox (registry blocked)
- [ ] Deploy workflow (blocked: needs GCP projects + Workload Identity Federation)
- [x] Render preview: single-container image + `render.yaml` (verified locally under a 512 MB limit
      with Render-style env; blueprint itself not yet applied — needs the owner's Render account)

### Phase 1 follow-ups (security & quality hardening)
- [ ] Nonce-based Content-Security-Policy (`script-src`) for web/admin
- [ ] Enforce MFA for staff roles
- [ ] Breached-password check (k-anonymity) on registration/reset
- [ ] Memorystore in-transit TLS (Redis client CA support)
- [ ] IAP in front of the admin service; Cloud Armor in front of the API
- [ ] Typed OpenAPI response schemas + client generation/diff in CI
- [ ] Axe accessibility checks in Playwright
- [ ] Expo SDK upgrade to clear the mobile-tooling audit exceptions
- [ ] Email change flow (with re-verification)
- [ ] Passkeys / WebAuthn as an additional factor

## Phase 2 — Music core
- [ ] Artist profiles, members, verification workflow
- [ ] Storage adapter (GCS + local emulator), signed upload URLs, rights declaration
- [ ] Audio worker: scan, validate, transcode (AAC/Opus/HLS), loudness, waveform, outbox
- [ ] Catalogue: tracks, albums, releases, genres, licences, track rights, status machine
- [ ] Moderation queue; content reports; takedowns and appeals
- [ ] Streaming grants (CDN signed URLs), playback sessions, listening events
- [ ] Web & mobile player on `@musicverse/audio-player`
- [ ] Playlists, favourites, history; search
- [ ] E2E journeys 3–7

## Phase 3 — Discovery & social
- [ ] Follows, feed, posts, comments, likes, sharing, blocking, reporting
- [ ] Communities and memberships; notifications (in-app + push)
- [ ] Recommendations v1, trending, regional charts; Artist Centre analytics v1
- [ ] E2E journeys 8–9

## Phase 4 — AI & creator tools
- [ ] AI provider abstraction, credits, usage, provenance (adapters only with approved credentials)
- [ ] Lyrics assistant, generation jobs, stem separation; Creator Studio projects; marketing assistant
- [ ] E2E journey 10

## Phase 5 — Commercial systems
- [ ] Payment provider abstraction + first verified integration (signed webhooks)
- [ ] IAP / Play Billing verification, subscriptions, AI credit packs, tips
- [ ] Marketplace, double-entry ledger, payouts, refunds, reconciliation, idempotency keys

## Phase 6 — Expansion
- [ ] DJ workspace, learning, events, radio, distribution integrations, advanced analytics
