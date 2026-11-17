# MusicVerse — Terraform (Google Cloud)

```
modules/platform/          one environment's full platform
  main.tf                  APIs, VPC + private services access, Artifact Registry
  data.tf                  Cloud SQL (Postgres 16, private IP, PITR), Memorystore, GCS buckets, Pub/Sub
  secrets.tf               Secret Manager (generated + operator-provided secrets)
  iam.tf                   least-privilege service accounts
  run.tf                   Cloud Run services (api, web, admin), migrate/purge jobs, Cloud Scheduler
  cdn.tf                   Cloud CDN for private media with signed URLs (when media_domain is set)
  monitoring.tf            uptime check + alert policies
environments/{dev,staging,prod}/main.tf   per-environment sizing; GCS remote state
```

## Status

**Not yet applied.** No GCP project, billing account or credentials have been provided. The code is
formatted (`terraform fmt`). `terraform validate` runs in CI (the `terraform` job); it could not
run in the original build environment because the provider registry was unreachable.

## First-time setup (per environment)

1. Create the project, link billing, and create a private, versioned state bucket
   (`gsutil mb -b on gs://<org>-musicverse-tfstate && gsutil versioning set on ...`).
   Restrict it to the deployment identity — generated secrets are stored in state.
2. `cp dev.tfvars.example dev.tfvars` and fill in values (no secrets in tfvars).
3. `terraform init -backend-config="bucket=<state-bucket>"`
4. Push images to Artifact Registry (the repository is created on the first apply; apply with
   `-target=module.platform.google_artifact_registry_repository.images` first if needed).
5. `terraform apply -var-file=dev.tfvars`
6. Add operator secrets: `gcloud secrets versions add musicverse-development-smtp-password --data-file=-`
7. Run migrations: `gcloud run jobs execute musicverse-development-migrate --region <region> --wait`
8. Map domains (api., admin., app) to the Cloud Run services and point media.<domain> at
   the `media_cdn_ip` output.

## Known follow-ups (tracked in TASKS.md)

- Memorystore in-transit TLS (requires CA support in the API's Redis client).
- Identity-Aware Proxy in front of the admin service in staging/production.
- Cloud Armor policy on an external load balancer in front of the API.
