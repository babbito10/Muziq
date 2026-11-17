# MusicVerse — API Architecture

Base URL: `/api/v1` · Format: JSON (UTF-8) · Spec: OpenAPI 3 served at `/api/docs` (UI) and
`/api/docs-json` (document) in non-production environments.

## 1. Conventions

| Topic | Convention |
|---|---|
| Versioning | URI prefix `/api/v1`. Breaking changes → `/api/v2`; old versions supported ≥ 6 months with `Deprecation`/`Sunset` headers. |
| Resource naming | Plural nouns, kebab-case (`/artist-centre`, `/playlists/{id}/tracks`). |
| IDs | UUID strings. |
| Timestamps | ISO-8601 UTC strings. |
| Auth | `Authorization: Bearer <access token>`; refresh via HttpOnly cookie (web) or body (mobile). |
| Validation | Zod schemas from `@musicverse/validation`; failures → `400 VALIDATION_FAILED` with field issues. |
| Pagination | Cursor based: `?limit=20&cursor=<opaque>` → `{ data: [...], page: { nextCursor, limit } }`. Max limit 100. |
| Filtering/sorting | Explicit allow-listed query params per endpoint (`?status=active&sort=-createdAt`). |
| Idempotency | `Idempotency-Key` header **required** on financial mutations (orders, payments, payouts, refunds, credit purchases); stored 24 h; replays return the original response. |
| Rate limiting | Global default 120 req/min/IP; auth endpoints stricter (e.g. login 10/min/IP); `429` with `Retry-After`. |
| Request IDs | `x-request-id` accepted or generated; echoed in responses and error bodies. |
| CSRF | Cookie-authenticated endpoints require header `x-csrf-protection: 1` plus `SameSite=Strict` cookies. |
| Cookies | `mv_refresh` (web) and `mv_admin_refresh` (admin), `HttpOnly; SameSite=Strict; Path=/api/v1/auth`, `Secure` outside local development. |

### Error envelope

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect.",
    "details": null,
    "requestId": "3f0c…"
  }
}
```

Error codes are a closed set in `@musicverse/types` (`VALIDATION_FAILED`, `UNAUTHENTICATED`,
`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `EMAIL_NOT_VERIFIED`, `MFA_REQUIRED`,
`INVALID_MFA_CODE`, `INVALID_CREDENTIALS`, `INVALID_TOKEN`, `ACCOUNT_SUSPENDED`,
`PROVIDER_NOT_CONFIGURED`, `INTERNAL_ERROR`, …).

## 2. Resource map

| Prefix | Module | Phase | Notes |
|---|---|---|---|
| `/health` | Health | 1 ✅ | `live`, `ready` |
| `/auth` | Identity | 1 ✅ | see §3 |
| `/users` | Users | 1 ✅ | `me`, preferences, capabilities, deletion |
| `/admin` | Administration | 1 ✅ (users, audit) | expands each phase |
| `/artists` | Artist profiles | 2 | CRUD, members, verification, followers |
| `/tracks` | Catalogue | 2 | CRUD, rights, licences, status transitions |
| `/albums` | Catalogue | 2 | CRUD, track ordering |
| `/playlists` | Listening | 2 | CRUD, items, collaborative |
| `/streaming` | Streaming | 2 | playback grants (signed URLs), sessions, events |
| `/discovery` | Discovery | 2–3 | search, genres, moods, new, trending, charts, recommendations |
| `/social` | Social | 3 | feed, posts, comments, likes, follows, blocks, reports |
| `/communities` | Social | 3 | communities, membership |
| `/ai` | AI Studio | 4 | providers, jobs, generations, credits |
| `/creator` | Creator Studio | 2 (uploads) / 4 | uploads, projects, recordings, stems, exports |
| `/artist-centre` | Artist Centre | 3–5 | dashboard, analytics, campaigns, revenue |
| `/marketplace` | Marketplace | 5 | products, orders, reviews, sellers |
| `/payments` | Payments | 5 | intents, provider webhooks, refunds, payouts |
| `/subscriptions` | Payments | 5 | plans, subscribe, cancel, IAP receipt verification |
| `/analytics` | Analytics | 3 | aggregate endpoints for dashboards |

## 3. Phase 1 endpoints (implemented)

| Method & path | Auth | Description |
|---|---|---|
| `GET /health/live` | public | Process liveness |
| `GET /health/ready` | public | DB + Redis readiness |
| `POST /auth/register` | public | Create account (listener role), send verification email, return tokens |
| `POST /auth/login` | public | Email + password → tokens, or `{ mfaRequired, mfaToken }` |
| `POST /auth/mfa/verify` | public (mfa token) | Exchange MFA challenge + TOTP code → tokens |
| `POST /auth/refresh` | refresh cookie/body + CSRF header (web) | Rotate refresh token, new access token |
| `POST /auth/logout` | refresh cookie/body | Revoke current session |
| `POST /auth/email/verify` | public | Consume verification token |
| `POST /auth/email/resend` | bearer | Resend verification email |
| `POST /auth/password/forgot` | public | Always 202; sends reset email if account exists |
| `POST /auth/password/reset` | public | Consume reset token, set password, revoke all sessions |
| `POST /auth/password/change` | bearer | Change password (requires current) |
| `POST /auth/oauth/google` | public | Verify Google ID token → tokens (503 if not configured) |
| `POST /auth/oauth/apple` | public | Verify Apple ID token → tokens (503 if not configured) |
| `GET /auth/providers` | public | Which sign-in providers are configured |
| `GET /auth/sessions` | bearer | List active sessions |
| `DELETE /auth/sessions/{id}` | bearer | Revoke one of own sessions |
| `POST /auth/mfa/totp/setup` | bearer | Start TOTP enrolment → otpauth URI |
| `POST /auth/mfa/totp/confirm` | bearer | Confirm enrolment with code |
| `POST /auth/mfa/totp/disable` | bearer | Disable with password + code |
| `GET /users/me` | bearer | Current user, profile, roles, permissions |
| `PATCH /users/me/profile` | bearer | Update display name, username, bio, locale, country |
| `PATCH /users/me/preferences` | bearer | Theme, explicit filter, notification prefs |
| `POST /users/me/capabilities` | bearer | Add capability role (`artist`,`producer`,`dj`,`business`,`educator`) |
| `DELETE /users/me/capabilities/{role}` | bearer | Remove capability role |
| `DELETE /users/me` | bearer + password | Schedule account deletion, revoke sessions |
| `GET /admin/users` | `admin:users.read` | Paginated, filter by status/role/email |
| `GET /admin/users/{id}` | `admin:users.read` | Detail with roles and sessions |
| `POST /admin/users/{id}/roles` | `admin:roles.manage` | Grant role |
| `DELETE /admin/users/{id}/roles/{role}` | `admin:roles.manage` | Revoke role |
| `POST /admin/users/{id}/suspend` | `admin:users.manage` | Suspend & revoke sessions |
| `POST /admin/users/{id}/reinstate` | `admin:users.manage` | Reinstate |
| `GET /admin/audit-logs` | `admin:audit.read` | Paginated audit log with filters |

## 4. Selected future contracts (design)

```
POST /creator/uploads                  → { uploadId, uploadUrl, expiresAt }   (rights declaration required)
POST /creator/uploads/{id}/complete    → 202 (processing queued)
POST /tracks/{id}/submit-for-review    → 200 status=in_review
POST /admin/moderation/tracks/{id}/approve | /reject
POST /tracks/{id}/publish              → 409 unless publication invariant holds
POST /streaming/grants { trackId }     → { url, expiresAt, format }   (entitlement check)
POST /streaming/events                 → 202 (batched listening events)
POST /ai/jobs { capability, providerKey, input }  (Idempotency-Key) → 202 { jobId }
POST /payments/webhooks/{provider}     (raw body, signature verified, idempotent by event id)
```

## 5. Client generation

`@musicverse/api-client` is hand-written against the shared Zod schemas/types for Phase 1 (small
surface, strict types). From Phase 2, the OpenAPI document is generated in CI and diffed to detect
unintentional breaking changes.
