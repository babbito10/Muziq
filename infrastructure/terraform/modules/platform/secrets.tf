# Secrets generated here are stored in Terraform state. The state bucket MUST be private,
# versioned and restricted to the deployment identity (see documentation/deployment).

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_bytes" "mfa_key" {
  length = 32
}

locals {
  generated_secrets = {
    "jwt-access-secret"  = random_password.jwt.result
    "mfa-encryption-key" = random_bytes.mfa_key.base64
    "database-url"       = "postgresql://${google_sql_user.app.name}:${random_password.db.result}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.app.name}?schema=public&sslmode=require"
    "redis-url"          = "redis://:${google_redis_instance.cache.auth_string}@${google_redis_instance.cache.host}:${google_redis_instance.cache.port}/0"
  }
  # Created empty: an operator adds the value (`gcloud secrets versions add`). Never commit it.
  manual_secrets = ["smtp-password"]
}

resource "google_secret_manager_secret" "generated" {
  for_each  = local.generated_secrets
  project   = var.project_id
  secret_id = "${local.name}-${each.key}"
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "generated" {
  for_each    = local.generated_secrets
  secret      = google_secret_manager_secret.generated[each.key].id
  secret_data = each.value
}

resource "google_secret_manager_secret" "manual" {
  for_each  = toset(local.manual_secrets)
  project   = var.project_id
  secret_id = "${local.name}-${each.value}"
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

locals {
  secret_ids = merge(
    { for k, s in google_secret_manager_secret.generated : k => s.secret_id },
    { for k, s in google_secret_manager_secret.manual : k => s.secret_id },
  )
}
