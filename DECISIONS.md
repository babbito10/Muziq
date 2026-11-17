# Architecture Decision Records

Format: context → decision → consequences. Status is *Accepted* unless stated.

## ADR-001 — TypeScript monorepo with pnpm workspaces and Turborepo
**Context.** Web, admin, mobile and API share contracts, validation and auth rules.
**Decision.** One repository; pnpm workspaces (`node-linker=hoisted` for Expo/Metro); Turborepo task
graph (`build` depends on `^build`); shared packages built with tsup to ESM + CJS + `.d.ts`.
**Consequences.** Contract changes are atomic across apps. Packages must be built before apps
(handled by Turbo). Hoisting trades strict isolation for React Native compatibility.

## ADR-002 — Modular monolith API, workers for slow work
**Context.** Small team, many domains, strong consistency needs (rights, money).
**Decision.** One NestJS service with bounded modules; Pub/Sub workers (same codebase, separate
entrypoints) for audio, AI and fan-out.
**Consequences.** Simple transactions and deployment now; extraction later along module boundaries.

## ADR-003 — Zod as the single validation language
**Context.** Nest defaults to class-validator; clients need the same rules for forms.
**Decision.** Zod 4 schemas in `@musicverse/validation`, applied in the API via a small
`ZodValidationPipe`; OpenAPI request schemas generated with `z.toJSONSchema`.
**Consequences.** No rule drift between client and server. Response schemas in OpenAPI are
currently untyped (TypeScript types are shared instead); typed responses are a follow-up.

## ADR-004 — Stateless access tokens + rotating opaque refresh tokens
**Context.** Need mobile + web, immediate revocation, theft detection, no tokens readable by JS.
**Decision.** 15-minute HS256 JWT access tokens (memory only on clients); 256-bit opaque refresh
tokens stored hashed, rotated on every use, previous hash retained for reuse detection with a 15 s
grace window; web/admin get `HttpOnly; SameSite=Strict` cookies (separate names), mobile gets the
token in the body and keeps it in the OS keychain.
**Consequences.** Refresh needs a DB round trip; reuse detection covers one rotation back. Move to
asymmetric signing (KMS) when a second service verifies tokens.

## ADR-005 — Per-request authorisation context cached in Redis
**Context.** Stateless JWTs would let logout/suspension/role removal lag up to 15 minutes.
**Decision.** The guard checks session + user status + roles on every request via a 60 s Redis
cache, invalidated explicitly on every relevant change, falling back to PostgreSQL if Redis fails.
**Consequences.** One Redis MGET per request; revocation is immediate (covered by tests).

## ADR-006 — Role matrix in code, synced to the database
**Context.** Permissions must be reviewable in PRs and identical in API and UIs.
**Decision.** `packages/auth` holds the matrix and grant policy. The idempotent seed syncs
`roles`/`permissions`/`role_permissions` on every deploy; `user_roles` references role rows.
**Consequences.** Permission changes ship as code + seed; the DB copy supports FKs and reporting.

## ADR-007 — Own TOTP implementation on node:crypto
**Context.** MFA needs a small, auditable surface.
**Decision.** RFC 6238 TOTP (SHA-1/6 digits/30 s) implemented in ~80 lines and verified against the
RFC test vectors; secrets AES-256-GCM encrypted with a versioned key; replay prevented by storing
the last accepted step with a conditional update.
**Consequences.** No dependency; WebAuthn/passkeys planned as an additional factor.

## ADR-008 — PostgreSQL full-text search first
**Context.** Search is needed in Phase 2; a search cluster adds cost and ops.
**Decision.** Postgres FTS + `pg_trgm`; revisit OpenSearch/Vertex AI Search on measured need.
**Status.** Proposed (Phase 2).

## ADR-009 — Browsers call the API directly; API URL injected at runtime
**Context.** Next.js rewrites are fixed at build time, preventing one image across environments, and
a proxy hop would hide client IPs from the rate limiter.
**Decision.** Web/admin call `api.<domain>` directly (same-site, CORS allow-list). The root layout
renders `PUBLIC_API_URL` into a JSON script tag per request.
**Consequences.** Pages render dynamically (fine on Cloud Run). The web and API origins must be
same-site for `SameSite=Strict` cookies.

## ADR-010 — Development mail transport is explicit and refused in production
**Context.** No email provider is configured yet, but flows must be testable.
**Decision.** `MAIL_TRANSPORT=console` logs messages (marked "NOT SENT") and keeps an in-memory
outbox for tests; config validation rejects it when `NODE_ENV=production`. Local Docker and E2E use
the real SMTP transport against Mailpit.
**Consequences.** No fake "success" can reach production.

## ADR-011 — Provider adapters only against official documentation and credentials
**Context.** AI, payments, fingerprinting and social sign-in depend on third parties.
**Decision.** Each integration is an interface + adapter; adapters ship disabled until credentials
exist (e.g. Google/Apple sign-in return `503 PROVIDER_NOT_CONFIGURED`). Mocks are labelled as such.
**Consequences.** Honest product surface; integration work is unblocked by credentials, not code.

## ADR-012 — Users are anonymised, not hard-deleted
**Context.** Account deletion vs. audit, rights and financial record integrity.
**Decision.** Deletion deactivates immediately; a scheduled job anonymises PII after 30 days and
keeps the row; `audit_logs` is append-only at the database level (trigger).
**Consequences.** Foreign keys stay valid; legal holds can extend retention.

## ADR-013 — Images without OS package installs
**Context.** Smaller attack surface; build environments may restrict OS package mirrors.
**Decision.** Alpine Node images with no `apk add` (base `libssl3` suffices for Prisma); init
process supplied by the runtime (`init: true`, Cloud Run).
**Consequences.** Smaller, reproducible images; health checks use busybox `wget`.
