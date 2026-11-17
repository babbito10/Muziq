# Database

MusicVerse uses PostgreSQL 16 with Prisma. To keep the schema, migrations and the code that uses
them versioned together, they live with the API:

| What | Where |
|---|---|
| Schema | [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) |
| Migrations | [`apps/api/prisma/migrations/`](../apps/api/prisma/migrations) (Prisma Migrate + raw SQL where needed) |
| Seed (roles, permissions, optional first super admin) | [`apps/api/src/database/seed.ts`](../apps/api/src/database/seed.ts) |
| Entity relationship design (all phases) | [`documentation/database/erd.md`](../documentation/database/erd.md) |

`migrations/` and `seeds/` in this folder hold cross-cutting SQL that is not owned by a single
service (none yet) and development fixtures (none yet).

## Commands

```bash
pnpm db:migrate   # create + apply a migration in development (prisma migrate dev)
pnpm db:deploy    # apply committed migrations (CI, containers, Cloud Run job)
pnpm db:seed      # idempotent: sync roles/permissions, optional super admin
```

The seed is safe to run on every deploy. Destructive operations (`prisma migrate reset`) must only
ever target a disposable development database.
