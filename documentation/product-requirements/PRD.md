# MusicVerse — Product Requirements Document

> **Tagline (proposed):** One world. Every sound. Endless possibilities.
>
> Status: v1.0 (Phase 1 baseline) · Owner: Product & Engineering · Last updated: 2026-11-17

## 1. Purpose

MusicVerse is an integrated music ecosystem that combines authorised streaming, discovery,
artist development, AI-assisted creation, production tooling, social networking, collaboration,
monetisation, learning and music-business services in a single product available on web,
Android and iOS.

This document defines *what* the product must do and *why*. The *how* lives in
[`../architecture/system-architecture.md`](../architecture/system-architecture.md).

## 2. Problem statement

Music people work across a fragmented tool chain: one app for listening, another for releasing,
a DAW for production, social networks for promotion, marketplaces for beats and services,
spreadsheets for royalties. Independent artists in particular lack an affordable, unified place
to create, release, grow an audience and get paid — with clear rights management.

## 3. Personas

| Persona | Primary goals | Key modules |
|---|---|---|
| **Listener** | Discover and play music, build playlists, follow artists | Streaming, Discovery, Social |
| **Independent artist / singer / songwriter** | Release music, grow fans, earn revenue | Profiles, Catalogue, Artist Centre, Marketplace |
| **Producer** | Make and sell beats, collaborate | Creator Studio, AI Studio, Marketplace |
| **DJ** | Prepare tracks, analyse BPM/key, plan sets | DJ Workspace, Catalogue |
| **Studio / label / music business** | Offer services, manage rosters, license catalogue | Marketplace, Artist Centre, Rights |
| **Educator / learner** | Teach and learn instruments and production | Learning |
| **Community organiser** | Run communities around genres/scenes | Social, Communities, Events |
| **Moderator / administrator** | Keep the platform lawful and safe | Administration, Governance |

**One account, many capabilities.** A single user may act as listener, artist, producer, DJ and
business simultaneously. Capabilities are *roles attached to one identity*, never separate accounts.

## 4. Product principles

1. **Rights first.** Nothing enters the public catalogue without an ownership declaration and a
   valid licence. Unlicensed commercial recordings are rejected.
2. **Honest technology.** No feature is advertised as live until it is implemented and tested.
   Third-party integrations without credentials ship as clearly labelled development adapters.
3. **Creator economics are auditable.** All money movement is recorded in a double-entry ledger.
4. **Accessible and premium.** Dark-first, WCAG 2.2 AA, keyboard- and screen-reader-friendly.
5. **Mobile parity for core journeys.** Listening, discovery, social and account management work
   on phones first-class.

## 5. Scope by module

Priority: **P0** = required for first public beta, **P1** = required for general availability,
**P2** = expansion. Phase = delivery phase in [`roadmap.md`](./roadmap.md).

### A. Identity & Access Management — Phase 1 (P0)
- Registration with email + password; email verification; login/logout; password recovery.
- Google and Apple sign-in (ID-token verification; enabled when credentials are configured).
- Secure sessions: short-lived access tokens, rotating refresh tokens, session list & revocation.
- Role-based access control with resource-level checks.
- Capability self-service: user can add/remove *artist, producer, DJ, business* capabilities.
- User preferences (theme, language, explicit-content filter, notification settings).
- Account deletion (soft delete → anonymisation after retention window).
- Multi-factor authentication (TOTP) enrolment, challenge and disable.

**Acceptance:** a user registers, verifies email, logs in on web and mobile, lists and revokes
sessions, enables TOTP MFA, adds the artist capability and deletes the account; every step is
audit-logged and covered by automated tests.

### B. User & Artist Profiles — Phase 2 (P0)
User profiles; artist profiles (bio, photo, cover, social links, genres, location); artist
verification workflow; discography; followers; artist statistics. An artist profile may have
multiple members (bands, labels managing artists).

### C. Music Catalogue — Phase 2 (P0)
Tracks, albums, singles, EPs, releases; genres and language metadata; artwork; audio assets;
descriptions; release dates; explicit classification; **ownership declarations; licensing
information**; content moderation states (`draft → processing → in_review → approved → published`,
with `rejected` and `taken_down`).

### D. Streaming — Phase 2 (P0)
Player (play/pause/seek/volume), queue, repeat, shuffle, playlists, playback history, recently
played, favourites, listening sessions. **Only authorised content is streamed**, via short-lived
signed URLs and CDN delivery from private storage.

### E. Discovery — Phases 2–3 (P0/P1)
Search (artists, tracks, albums); genre and mood discovery; new releases; trending; emerging
artists; regional charts; personalised recommendations; similar artists. Recommendation engine
is modular: metadata + engagement heuristics first, ML models pluggable later.

### F. Social Network — Phase 3 (P1)
Feeds, artist posts, likes, comments, replies, follows, sharing, notifications, communities and
memberships, reporting, blocking.

### G. AI Music Studio — Phase 4 (P1)
Provider abstraction for songwriting, lyrics, music/instrumental generation, vocal processing,
enhancement, stem separation, classification, promotional content. Adapters are built **only**
against official documentation with approved credentials. Credits, usage, cost, history and
commercial-use permissions are tracked per generation.

### H. Creator Studio — Phase 4 (P1)
Uploads, recordings, projects, basic editing, waveform display, beat library, metadata,
collaboration, exports. Data model ready for future multitrack production.

### I. DJ Workspace — Phase 6 (P2)
Track preparation, BPM/key metadata, cue points, beat grids, loops, effects, transitions.
**Live mixing is not claimed** until an audio engine and hardware integrations exist and are tested.

### J. Artist Centre — Phases 3–5 (P1)
Dashboard, release management, audience/follower/listening analytics, campaigns, promotional
content, fan engagement, artist subscriptions, revenue reporting.

### K. Marketplace — Phase 5 (P1)
Beats, samples, producer and studio services, licensing listings, orders, transactions, reviews,
seller management, with ownership and commercial-licence checks before listing.

### L. Learning — Phase 6 (P2)
Lessons, instrument categories, resources, tutorials, exercises, progress tracking, teacher profiles.

### M. Events & Radio — Phase 6 (P2)
Concert discovery, artist events, listings, ticket links, radio station listings, authorised live
broadcasts only.

### N. Administration — Phases 1–5 (P0 core)
User & artist administration, moderation, copyright reports, takedowns, appeals, payment and
subscription monitoring, AI usage monitoring, analytics, audit logs, security monitoring.
Phase 1 delivers user administration (list, role grants, suspension) and the audit-log viewer.

## 6. Key user journeys (must be covered by end-to-end tests by the phase that delivers them)

| # | Journey | Phase |
|---|---|---|
| 1 | A listener registers | 1 |
| 2 | An artist registers (account + artist capability) | 1 (capability) / 2 (profile) |
| 3 | An artist uploads authorised music | 2 |
| 4 | An administrator reviews the upload | 2 |
| 5 | The artist publishes the music | 2 |
| 6 | A listener discovers the artist | 2–3 |
| 7 | The listener plays a track | 2 |
| 8 | The listener follows the artist | 3 |
| 9 | The artist views analytics | 3 |
| 10 | An authorised user creates an AI generation job | 4 |

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Availability | 99.9 % monthly for API and streaming (GA target) |
| Latency | p95 API < 300 ms for reads; playback start < 1.5 s on 4G |
| Scale (GA target) | 1 M registered users, 50 k concurrent streams, 5 M tracks |
| Security | OWASP ASVS L2; secrets in Secret Manager; TLS everywhere; audit logs for privileged actions |
| Privacy | GDPR/Kenya DPA-style rights: export, deletion, consent records |
| Accessibility | WCAG 2.2 AA on web; platform accessibility APIs on mobile |
| Internationalisation | UTF-8 everywhere, locale-aware formatting, language metadata on content |
| Observability | Structured logs with request IDs, metrics, traces, alerting |
| Portability | Payment, AI, email, storage behind adapter interfaces; no single-country assumptions |

## 8. Out of scope (until explicitly scheduled)

- Streaming of any content MusicVerse is not authorised to distribute.
- Professional live DJ mixing and hardware controller support (Phase 6+ research).
- Physical merchandise fulfilment.
- Payments in production without a verified provider integration and webhook signature checks.

## 9. Success metrics

- Activation: % of registrations that verify email and play ≥ 1 track within 7 days.
- Creator activation: % of artist-capability users who publish ≥ 1 release within 30 days.
- Retention: D30 listener retention; monthly active creators.
- Trust: median takedown resolution time; % uploads with complete rights metadata (target 100 %).
- Revenue (Phase 5+): GMV, payout accuracy (ledger reconciliation discrepancies = 0).

## 10. External dependencies & approvals required

| Dependency | Needed for | Status |
|---|---|---|
| SMTP / transactional email provider | Verification & password reset in staging/prod | **Not configured** — dev console adapter in use |
| Google OAuth client ID | Google sign-in | **Not configured** — adapter implemented, disabled |
| Apple Services ID + team/key | Apple sign-in | **Not configured** — adapter implemented, disabled |
| Google Cloud project + billing | Deployment | **Not provisioned** — Terraform prepared |
| Payment providers (card, IAP, Play Billing, local methods) | Phase 5 | Not started |
| AI providers with commercial terms | Phase 4 | Not started |
| Content licences / label agreements | Catalogue beyond user uploads | Business task |
