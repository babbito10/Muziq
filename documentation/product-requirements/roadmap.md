# MusicVerse — Detailed Implementation Roadmap

Each phase is split into milestones that are independently testable. A milestone is **done** only
when its exit criteria pass in CI. Live progress is tracked in [`/TASKS.md`](../../TASKS.md).

## Phase 1 — Foundation

| Milestone | Scope | Exit criteria |
|---|---|---|
| 1.0 Planning | PRD, architecture, ERD, API, security, cloud, roadmap, repo structure | Documents reviewed & committed |
| 1.1 Monorepo | pnpm workspaces, Turborepo, shared tsconfig/ESLint/Jest config, root scripts | `pnpm build`, `pnpm lint`, `pnpm typecheck` green |
| 1.2 Shared packages | types, validation, auth (RBAC matrix), api-client, ui, audio-player (queue engine) | packages build (ESM+CJS+d.ts) and unit tests pass |
| 1.3 Database | Prisma schema (identity + audit), initial migration, seed (roles/permissions/admin) | `prisma migrate deploy` on clean DB; seed idempotent |
| 1.4 API foundation | Nest bootstrap, config validation, logging, error envelope, Zod pipe, rate limiting, health, OpenAPI | health/ready reports DB+Redis; error contract tests |
| 1.5 Authentication | register, login, refresh rotation + reuse detection, logout, email verify, password forgot/reset/change, sessions, MFA TOTP, Google/Apple adapters, RBAC guards, capabilities, account deletion, admin users/audit | API integration tests against real Postgres + Redis |
| 1.6 Web | design system, app shell & navigation, auth pages, account settings (profile, sessions, MFA, capabilities, deletion) | component tests + Playwright journey "listener registers" |
| 1.7 Admin | admin sign-in, users list/detail, role grant/revoke, suspend, audit log viewer | component tests; permission enforcement tested at API |
| 1.8 Mobile | Expo Router app: sign-in/up, home, account, SecureStore tokens | typecheck + unit tests |
| 1.9 DevOps | Dockerfiles, docker-compose dev env, GitHub Actions CI, Terraform skeleton | compose stack healthy; CI workflow defined |

## Phase 2 — Music core

1. **2.1 Artist profiles** — artist_profiles/members/verifications; create/edit; verification request + admin review.
2. **2.2 Storage & upload** — GCS adapter (+ local emulator/MinIO for dev), signed upload URLs, rights declaration flow, media_assets.
3. **2.3 Audio pipeline worker** — Pub/Sub consumer, ffprobe validation, ffmpeg transcode (AAC/Opus/HLS), loudness, waveform peaks, malware-scan adapter, outbox.
4. **2.4 Catalogue** — tracks, albums, releases, genres, licences, track_rights; status machine; publication invariant.
5. **2.5 Moderation** — admin review queue, approve/reject, content reports, takedown + appeal workflows.
6. **2.6 Streaming** — entitlement checks, CDN signed URLs, playback sessions, listening events.
7. **2.7 Player** — web player bar using `@musicverse/audio-player`; mobile player with `expo-audio`; queue/repeat/shuffle UI.
8. **2.8 Library** — playlists, favourites, history, recently played.
9. **2.9 Search** — Postgres FTS + trigram across artists/tracks/albums.
10. **E2E journeys 2–7** (artist uploads → admin reviews → publish → discover → play).

## Phase 3 — Discovery & social
Follows, feeds, posts/comments/likes/replies, sharing, communities, notifications (in-app + push via Expo/FCM/APNs), blocking/reporting, recommendation engine v1 (metadata + engagement heuristics), trending/charts (Redis counters → nightly roll-ups), Artist Centre analytics v1, BigQuery export. E2E journeys 8–9.

## Phase 4 — AI & creator tools
AI provider abstraction + registry; credit accounting; first adapters **only after** provider selection, contract and credentials; lyrics assistant; generation jobs via Pub/Sub; stem separation adapter; creator projects/recordings/stems/collaboration; waveform editor (trim/fade); marketing assistant. E2E journey 10.

## Phase 5 — Commercial systems
Payment provider abstraction; first provider integration (selected per launch markets) with webhook signature verification; Apple IAP & Google Play Billing server-side verification; subscriptions; AI credit packs; fan tips; marketplace (products, licences, orders, reviews, sellers); double-entry ledger; payouts; refunds; reconciliation jobs; idempotency middleware.

## Phase 6 — Expansion
DJ workspace (BPM/key analysis, cue points, beat grids, loops; audio engine R&D), learning (lessons, exercises, progress, teachers), events & ticket links, radio listings & authorised broadcasts, external distribution integrations, advanced analytics.

## Cross-phase tracks
- **Security:** threat-model review per phase; staff MFA enforcement (Phase 2); pen-test before beta.
- **Accessibility:** axe checks in Playwright from Phase 1; manual audit before beta.
- **Performance:** k6 load tests for streaming grants and auth from Phase 2.
- **Docs:** CHANGELOG, TASKS, DECISIONS updated every milestone.
