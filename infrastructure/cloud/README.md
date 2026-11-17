# Cloud deployment runbook (Google Cloud)

Infrastructure is defined in [`../terraform`](../terraform). This runbook covers releasing code.

## Release flow

```
merge to main ─▶ CI green ─▶ build & push images (tag = git SHA) to Artifact Registry
             ─▶ terraform apply -var image_tag=<sha>        (development)
             ─▶ gcloud run jobs execute <env>-migrate --wait (migrations + role sync)
             ─▶ new Cloud Run revisions receive traffic
tag vX.Y.Z  ─▶ promote the same image digests to staging ─▶ smoke tests ─▶ approval ─▶ production
```

Migrations are backwards compatible (expand → migrate → contract), so the previous revision keeps
working while the job runs, and rollback is `gcloud run services update-traffic --to-revisions`.

## CI identity

GitHub Actions authenticates with **Workload Identity Federation** (no JSON keys). Required, per
environment: a deploy service account with `roles/run.admin`, `roles/artifactregistry.writer`,
`roles/iam.serviceAccountUser` on the runtime service accounts, and Terraform state bucket access.
An automated deploy workflow is not enabled yet because no GCP project exists (see TASKS.md).

## Operator checklist before the first production deploy

- [ ] SMTP provider account, domain authentication (SPF, DKIM, DMARC), `smtp-password` secret
- [ ] Google / Apple client IDs if social sign-in is wanted
- [ ] DNS for app, api., admin., media. subdomains
- [ ] IAP for the admin service; alert notification channels
- [ ] Restore drill from a Cloud SQL backup into staging
