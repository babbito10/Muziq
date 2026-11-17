# Changelog

All notable changes to MusicVerse. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-11-17 — Phase 1: Foundation

### Added
- Planning documents: PRD, roadmap, system architecture, database ERD (all domains), API
  architecture, security & rights plan, cloud infrastructure plan; ARCHITECTURE, DECISIONS, TASKS.
- pnpm + Turborepo monorepo with shared packages: `types`, `validation`, `auth`, `api-client`,
  `ui`, `audio-player`, `shared-config`.
- **API** (NestJS, Prisma, PostgreSQL, Redis): registration, login, logout, rotating refresh tokens
  with reuse detection, email verification, password recovery and change, session management,
  TOTP MFA, Google/Apple ID-token verification (disabled until configured), RBAC with immediate
  revocation, capability roles, preferences, account deletion with scheduled anonymisation,
  admin user/role/suspension management, append-only audit log, rate limiting, health checks,
  OpenAPI documentation.
- **Web** (Next.js): app shell, authentication flows, account settings, light/dark theme.
- **Admin console** (Next.js): staff sign-in, users, roles, suspension, audit log.
- **Mobile** (Expo): sign in/up with MFA, home, account; keychain token storage.
- Docker images and docker-compose development stack (with Mailpit).
- GitHub Actions CI; Terraform for Google Cloud (Cloud Run, Cloud SQL, Memorystore, GCS, CDN,
  Pub/Sub, Secret Manager, monitoring).
- 196 automated tests: 65 package unit, 29 API unit, 66 API integration (real PostgreSQL + Redis),
  24 web component, 3 admin component, 2 mobile unit, 7 Playwright end-to-end.

### Security
- Upgraded Next.js to 15.5.29 and nodemailer to 10.x; overrides for `deepmerge-ts` and `postcss`;
  removed optional `sharp`. Remaining audit exceptions are Expo mobile tooling only (SECURITY.md).
