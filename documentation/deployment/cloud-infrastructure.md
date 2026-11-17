# MusicVerse — Cloud Infrastructure Plan (Google Cloud)

Status: v1.0 · Terraform in [`/infrastructure/terraform`](../../infrastructure/terraform)

> **Not yet provisioned.** No GCP project, billing account or credentials have been supplied.
> The Terraform configuration is authored and formatted. `terraform validate` and `plan` could
> not run in the build environment because the Terraform provider registry was unreachable; they
> must be run in CI or locally once access exists.

## 1. Environments

| Env | GCP project (proposed) | Purpose | Scale |
|---|---|---|---|
| development | `musicverse-dev` | shared integration env, auto-deployed from `main` | min instances 0 |
| staging | `musicverse-staging` | release candidates, production-like data volume (synthetic) | min 1 |
| production | `musicverse-prod` | live | min 2 API, autoscale |

One project per environment isolates IAM, quotas and billing. Terraform root
`infrastructure/terraform/environments/<env>` composes shared modules with per-env variables.

## 2. Services

| Component | GCP service | Notes |
|---|---|---|
| API | Cloud Run (service `musicverse-api`) | container from Artifact Registry; VPC connector to Cloud SQL private IP & Memorystore; min/max instances per env |
| Web | Cloud Run (`musicverse-web`) | Next.js standalone output |
| Admin | Cloud Run (`musicverse-admin`) | IAP or allow-listed ingress in prod |
| Workers | Cloud Run (`musicverse-worker-audio`, …) | Pub/Sub push subscriptions with OIDC auth; ffmpeg image |
| Database | Cloud SQL for PostgreSQL 16 | private IP, HA (regional) in prod, PITR, automated backups, `max_connections` sized for Cloud Run concurrency |
| Cache | Memorystore for Redis 7 | BASIC in dev/staging, STANDARD_HA in prod |
| Object storage | Cloud Storage | buckets: `ingest` (private, lifecycle 7 d for abandoned), `media` (private, CDN origin via backend bucket + signed URLs/cookies), `public-assets` (artwork, CDN) |
| CDN | Cloud CDN on external HTTPS LB | signed URL keys stored in Secret Manager; cache static & media renditions |
| Messaging | Pub/Sub | topics listed in architecture §8, dead-letter topics, 7-day retention |
| Secrets | Secret Manager | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `MFA_ENCRYPTION_KEY`, `SMTP_*`, OAuth secrets, CDN signing keys |
| Images | Artifact Registry (Docker) | per-env repo; vulnerability scanning on |
| Observability | Cloud Logging, Monitoring, Trace, Error Reporting | uptime checks on `/api/v1/health/ready`; alert policies (5xx rate, p95 latency, DB CPU, failed jobs) |
| Identity for CI | Workload Identity Federation | GitHub OIDC → deploy service account |

## 3. Networking

- Custom VPC per env; Serverless VPC Access connector (or Direct VPC egress) for Cloud Run.
- Cloud SQL private IP only; no public IP in staging/prod.
- External HTTPS Load Balancer with managed certificates for `musicverse.app`, `api.`, `admin.`,
  `media.` (CDN). Cloud Armor policy (OWASP CRS, rate rules) in prod.

## 4. Deployment pipeline

```
PR → CI (lint, typecheck, unit + integration tests, build, e2e) → merge to main
main → build images (api, web, admin) → push to Artifact Registry (dev)
     → run `prisma migrate deploy` as a Cloud Run Job → deploy Cloud Run revisions (dev)
tag v* → promote same image digests to staging → smoke tests → manual approval → production
```

Rollback = route traffic to the previous Cloud Run revision; migrations are backwards compatible
(expand/contract), so rollback does not require down-migrations.

## 5. Backup & disaster recovery

| Item | Policy |
|---|---|
| Cloud SQL | Automated daily backups; PITR (prod 30 d); cross-region backup copy in prod |
| GCS media | Object versioning on `media` bucket; dual-region bucket in prod |
| RPO / RTO targets (prod) | RPO ≤ 15 min, RTO ≤ 4 h |
| Drills | Quarterly restore into staging; documented results |

## 6. Cost controls

Budgets & alerts per project; min instances 0 in dev; lifecycle rules on ingest bucket; CDN for
egress-heavy media; Pub/Sub retention tuned.

## 7. Local development parity

`infrastructure/docker/docker-compose.yml` runs Postgres 16, Redis 7, Mailpit (SMTP catcher), the
API and the web app. GCS/Pub/Sub emulators are added in Phase 2 when the media pipeline lands.
