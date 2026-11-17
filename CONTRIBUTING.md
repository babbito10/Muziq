# Contributing to MusicVerse

## Prerequisites

Node.js 22 (`.nvmrc`), pnpm 10 (`corepack enable`), and either Docker or local PostgreSQL 16 +
Redis 7. Mailpit is optional locally (needed for the E2E suite).

## Workflow

1. Branch from `main`: `feature/<short-name>` or `fix/<short-name>`.
2. Keep changes small and focused; update docs, `TASKS.md` and `CHANGELOG.md` in the same PR.
3. Run before pushing:
   ```bash
   pnpm format && pnpm lint && pnpm typecheck && pnpm test
   pnpm test:e2e        # when touching web/API flows (needs Postgres, Redis, Mailpit)
   ```
4. Open a PR; CI must be green and a reviewer must approve.

## Conventions

- **TypeScript strict** everywhere. No `any` without a comment explaining why.
- **Validation**: request schemas live in `packages/validation` and are reused by clients.
- **Authorisation**: every API route is authenticated unless `@Public()`. Add permissions to
  `packages/auth/src/matrix.ts`; enforce with `@RequirePermissions` plus resource checks in services.
- **Errors**: throw `AppError` with a code from `packages/types/src/errors.ts`.
- **Audit**: security-relevant changes call `AuditService.record` inside the same transaction.
- **Database**: every schema change ships a migration (`pnpm db:migrate`); CI fails on drift.
  Destructive changes follow expand → migrate → contract.
- **Integrations**: build against official docs; ship disabled until credentials exist; label
  development mocks clearly. Never present a mock as a live integration.
- **UI**: use `@musicverse/ui`; no buttons or links that do nothing — unbuilt features are shown
  as disabled with a reason. Every form field has a label; errors are announced.
- **Tests**: unit tests next to code (`*.spec.ts` / `*.test.ts(x)`), API integration tests in
  `apps/api/test`, E2E in `apps/web/e2e`.
- **Commits**: imperative subject ≤ 72 chars, body explains why.

## Releasing

See [`infrastructure/cloud/README.md`](infrastructure/cloud/README.md).
