locals {
  vpc_egress = {
    network    = google_compute_network.vpc.id
    subnetwork = google_compute_subnetwork.run.id
  }

  api_env = {
    NODE_ENV               = "production"
    LOG_LEVEL              = "info"
    WEB_APP_URL            = var.web_url
    CORS_ORIGINS           = "${var.web_url},${var.admin_url}"
    TRUST_PROXY            = "1"
    SWAGGER_ENABLED        = local.is_prod ? "false" : "true"
    COOKIE_SECURE          = "true"
    RATE_LIMIT_ENABLED     = "true"
    MAIL_TRANSPORT         = "smtp"
    MAIL_FROM              = var.mail_from
    SMTP_HOST              = var.smtp_host
    SMTP_PORT              = tostring(var.smtp_port)
    SMTP_USER              = var.smtp_user
    GOOGLE_CLIENT_IDS      = var.google_client_ids
    APPLE_CLIENT_IDS       = var.apple_client_ids
    JWT_ACCESS_TTL_SECONDS = "900"
  }

  api_secret_env = {
    DATABASE_URL       = "database-url"
    REDIS_URL          = "redis-url"
    JWT_ACCESS_SECRET  = "jwt-access-secret"
    MFA_ENCRYPTION_KEY = "mfa-encryption-key"
    SMTP_PASSWORD      = "smtp-password"
  }
}

# ---------------------------------------------------------------- API service
resource "google_cloud_run_v2_service" "api" {
  project             = var.project_id
  name                = "${local.name}-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = local.is_prod
  labels              = local.labels

  template {
    service_account                  = google_service_account.api.email
    max_instance_request_concurrency = 80
    timeout                          = "30s"

    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.api_max_instances
    }

    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"
      network_interfaces {
        network    = local.vpc_egress.network
        subnetwork = local.vpc_egress.subnetwork
      }
    }

    containers {
      image = var.api_image
      ports {
        container_port = 4000
      }
      resources {
        limits            = { cpu = "1", memory = "1Gi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      dynamic "env" {
        for_each = local.api_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.api_secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = local.secret_ids[env.value]
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/api/v1/health/ready"
        }
        initial_delay_seconds = 2
        period_seconds        = 5
        failure_threshold     = 12
      }
      liveness_probe {
        http_get {
          path = "/api/v1/health/live"
        }
        period_seconds = 30
      }
    }
  }

  depends_on = [google_secret_manager_secret_iam_member.api, google_secret_manager_secret_version.generated]
}

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------- web & admin
resource "google_cloud_run_v2_service" "frontend" {
  for_each = {
    web   = { image = var.web_image, min = var.web_min_instances }
    admin = { image = var.admin_image, min = 0 }
  }
  project             = var.project_id
  name                = "${local.name}-${each.key}"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = local.is_prod
  labels              = local.labels

  template {
    service_account = google_service_account.frontend.email
    scaling {
      min_instance_count = each.value.min
      max_instance_count = 10
    }
    containers {
      image = each.value.image
      ports {
        container_port = 3000
      }
      env {
        name  = "PUBLIC_API_URL"
        value = var.api_public_url
      }
      resources {
        limits   = { cpu = "1", memory = "512Mi" }
        cpu_idle = true
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend["web"].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "admin_public" {
  count    = var.admin_public ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend["admin"].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------- jobs
# Run before routing traffic to a new API revision: `gcloud run jobs execute <name> --wait`.
resource "google_cloud_run_v2_job" "api" {
  for_each = {
    migrate = "node_modules/.bin/prisma migrate deploy && node dist/database/seed.js"
    purge   = "node dist/jobs/purge-deleted-accounts.js"
  }
  project             = var.project_id
  name                = "${local.name}-${each.key}"
  location            = var.region
  deletion_protection = local.is_prod
  labels              = local.labels

  template {
    template {
      service_account = google_service_account.api.email
      max_retries     = 1
      timeout         = "600s"
      vpc_access {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = local.vpc_egress.network
          subnetwork = local.vpc_egress.subnetwork
        }
      }
      containers {
        image   = var.api_image
        command = ["sh", "-c"]
        args    = [each.value]
        dynamic "env" {
          for_each = local.api_env
          content {
            name  = env.key
            value = env.value
          }
        }
        dynamic "env" {
          for_each = local.api_secret_env
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = local.secret_ids[env.value]
                version = "latest"
              }
            }
          }
        }
      }
    }
  }

  depends_on = [google_secret_manager_secret_iam_member.api]
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_purge" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.api["purge"].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

resource "google_cloud_scheduler_job" "purge" {
  project   = var.project_id
  region    = var.region
  name      = "${local.name}-purge-deleted-accounts"
  schedule  = "17 3 * * *"
  time_zone = "Etc/UTC"

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.api["purge"].name}:run"
    oauth_token {
      service_account_email = google_service_account.scheduler.email
    }
  }
}
