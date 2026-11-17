# MusicVerse — Security & Rights Management Plan

Status: v1.0 · Baseline: OWASP ASVS 4.0 Level 2 · Owner: Security Engineering

## 1. Threat model summary

| Asset | Threats | Primary controls |
|---|---|---|
| User accounts | credential stuffing, phishing, session theft | argon2id, rate limits, MFA, refresh rotation + reuse detection, HttpOnly cookies, session revocation |
| Unreleased masters & stems | leakage, piracy | private buckets, short-lived signed URLs, no public object ACLs, originals never CDN-served |
| Catalogue integrity | unlicensed uploads, impersonation | ownership declarations, licence records, moderation, fingerprinting, artist verification |
| Money | fraud, double-spend, fake confirmations | provider webhooks with signature verification, server-side provider lookups, idempotency, double-entry ledger |
| Admin plane | privilege escalation | separate admin app, staff roles admin-granted only, MFA required for staff (Phase 2 enforcement), audit logs |
| AI generations | unlicensed commercial use, prompt abuse | provenance records, commercial-use flags, provider ToS snapshots, content moderation |
| Secrets | leakage via repo/logs | Secret Manager, `.env` git-ignored, log redaction, secret scanning in CI |

## 2. Authentication

- Passwords: **argon2id** (`@node-rs/argon2`, memory 19 MiB, t=2, p=1 — OWASP minimum), length
  10–128, checked against a small common-password deny-list; never logged.
- Login responses are uniform for unknown email vs wrong password (no account enumeration);
  `forgot password` always returns 202.
- Access JWT 15 min; refresh token 30 days sliding, rotated on each use, stored hashed (SHA-256).
  Reuse of a rotated refresh token ⇒ revoke the entire session family + audit event.
- Web refresh cookie: `HttpOnly; Secure (non-local); SameSite=Strict; Path=/api/v1/auth`.
- Verification/reset tokens: 32 random bytes, hashed at rest, single use, 24 h / 30 min expiry.
  Password reset revokes all sessions.
- MFA: TOTP (SHA-1, 6 digits, 30 s, ±1 step window), secrets AES-256-GCM encrypted with
  `MFA_ENCRYPTION_KEY`; replay prevented by storing the last accepted time step.
- Social login: ID tokens verified (signature via provider JWKS, `iss`, `aud`, `exp`, `nonce` when
  supplied). Accounts are linked to an existing email only if the provider asserts the email is verified.
- Suspended users cannot log in or refresh; suspension revokes sessions immediately.

## 3. Authorisation

- Deny by default: every route requires authentication unless decorated `@Public()`.
- Permission guard checks `@RequirePermissions(...)` against permissions derived from roles at
  request time (roles re-read from DB on refresh; access tokens short-lived).
- Resource-level checks in services (ownership, artist membership, community role).
- Staff role grants require `admin:roles.manage`; `super_admin` can only be granted by
  `super_admin`; users cannot remove their own admin role (prevents lock-out) — all audit-logged.

## 4. Input, transport and web security

- All input validated with Zod (strict objects — unknown keys rejected); bodies capped at 1 MB on
  JSON routes (uploads go directly to storage).
- Prisma parameterises all queries; raw SQL only through tagged templates.
- `helmet` headers; CSP on web/admin (admin: no third-party scripts).
- CORS allow-list from configuration; credentials only for listed origins.
- CSRF: access tokens are never in cookies; cookie-authenticated endpoints (`/auth/refresh`,
  `/auth/logout`) require `x-csrf-protection` header (forces CORS preflight) + SameSite=Strict.
- TLS 1.2+ everywhere (Cloud Run/HTTPS LB managed certs); HSTS on production domains.
- Rate limiting via Redis-backed throttler: default 120/min/IP; login 10/min; register 5/min;
  forgot-password 5/min; per-account lockout signals (Phase 2: progressive delays).

## 5. Data protection

- Encryption at rest: Cloud SQL and GCS (Google-managed keys; CMEK option for production).
- Field-level encryption for MFA secrets and (Phase 5) payout destination details.
- PII minimisation: IP addresses stored truncated (/24 IPv4, /48 IPv6) in sessions & audit logs.
- Logs redact `authorization`, `cookie`, `set-cookie`, `password`, `token` fields.
- Account deletion: immediate session revocation + `pending_deletion`; anonymisation job after
  30-day grace period; financial records retained per law with pseudonymised references.
- Backups: Cloud SQL automated daily backups + PITR (7 days dev/staging, 30 days prod); quarterly
  restore drills documented in `documentation/deployment/`.

## 6. Secrets management

- No secrets in Git. `.env` files are git-ignored; `.env.example` contains placeholders only.
- Cloud: Secret Manager → Cloud Run env injection; per-environment secrets; least-privilege
  service accounts; rotation runbook for JWT, MFA encryption key (key versioning) and DB passwords.
- CI: GitHub Actions uses Workload Identity Federation to GCP (no long-lived JSON keys).

## 7. Audit logging

Append-only `audit_logs` records: registrations, logins (success/failure), MFA changes, password
changes/resets, session revocations, refresh-token reuse detection, role grants/revocations,
suspensions, account deletion; later: moderation decisions, takedowns, payouts, refunds, admin
data access. Each entry has actor, target, request id, truncated IP, user agent and metadata.

## 8. Rights management

### 8.1 Upload rights declaration (Phase 2)
Every upload requires, before a signed upload URL is issued:
1. Rights basis: `original_owned`, `licensed` (exclusive/non-exclusive), `public_domain`,
   `creative_commons` (with licence variant), or `ai_generated` (with generation id).
2. Rights holders and splits for master and composition (sum 100 %).
3. Sworn declaration checkbox (timestamped, stored with user id, IP, user agent).
4. Licence evidence upload when basis is `licensed`.

### 8.2 Catalogue gate
- New uploads land in `in_review`; only `approved` content can be published.
- Audio fingerprinting adapter (provider TBD; requires commercial agreement) flags matches against
  known commercial recordings → automatic hold for moderator review.
- **Unlicensed commercial recordings are rejected and never enter the public catalogue.**
- Repeat infringer policy: strikes per account; 3 upheld strikes ⇒ upload privileges revoked.

### 8.3 Copyright complaints, takedown & appeal
```
report received (content_reports/takedown_requests) → triage (moderator)
  → action: content set to taken_down (hidden, streams revoked, CDN cache invalidated)
  → uploader notified with reason + appeal link
  → appeal/counter-notice (appeals) → decision → restored | upheld (strike)
```
SLAs: acknowledge within 24 h; action valid notices within 72 h. Every step is audit-logged.

### 8.4 AI-generated content
Each generation records provider, model, model version, generation date, requesting user,
input summary, commercial-use permission and a snapshot/URL of the provider usage terms.
Content may only be published commercially when `commercial_use_permitted = true`.

## 9. Payments security (Phase 5)
- Never store PAN/CVV — use provider-hosted fields/SDKs (PCI SAQ-A scope).
- Transactions become `succeeded` only after a **signed webhook** is verified **and** the provider
  API confirms status; frontend callbacks are informational only.
- All money movement is written to the double-entry ledger; nightly reconciliation against
  provider settlement reports; discrepancies alert finance.
- Idempotency keys on every financial mutation.

## 10. Secure SDLC
- Branch protection, PR review, CI gates (lint, typecheck, tests, `pnpm audit --prod` high+,
  secret scanning, dependency review).
- Dependabot/Renovate for dependency updates.
- Pen-test before public beta and annually; vulnerability disclosure via `SECURITY.md`.
- Incident response runbook (Phase 2) with severity matrix and 72-hour breach notification process.
