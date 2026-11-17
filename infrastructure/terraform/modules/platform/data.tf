# ---------------------------------------------------------------- Cloud SQL (PostgreSQL 16)
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "main" {
  project             = var.project_id
  name                = "${local.name}-pg"
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = var.db_deletion_protection

  settings {
    tier              = var.db_tier
    availability_type = var.db_high_availability ? "REGIONAL" : "ZONAL"
    disk_autoresize   = true
    disk_type         = "PD_SSD"
    user_labels       = local.labels

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.vpc.id
      enable_private_path_for_google_cloud_services = true
      ssl_mode                                      = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "02:00"
      transaction_log_retention_days = min(var.db_backup_retention_days, 7)
      backup_retention_settings {
        retained_backups = var.db_backup_retention_days
      }
    }

    maintenance_window {
      day  = 7
      hour = 3
    }

    insights_config {
      query_insights_enabled = true
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }
  }

  depends_on = [google_service_networking_connection.private_services]
}

resource "google_sql_database" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = "musicverse"
}

resource "google_sql_user" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = "musicverse"
  password = random_password.db.result
}

# ---------------------------------------------------------------- Memorystore (Redis 7)
resource "google_redis_instance" "cache" {
  project            = var.project_id
  name               = "${local.name}-redis"
  region             = var.region
  tier               = var.redis_tier
  memory_size_gb     = var.redis_memory_gb
  redis_version      = "REDIS_7_2"
  authorized_network = google_compute_network.vpc.id
  auth_enabled       = true
  # In-transit TLS requires the API to trust the instance CA; tracked in TASKS.md (Phase 2).
  transit_encryption_mode = "DISABLED"
  labels                  = local.labels
  depends_on              = [google_project_service.apis]
}

# ---------------------------------------------------------------- Cloud Storage
resource "google_storage_bucket" "ingest" {
  project                     = var.project_id
  name                        = "${local.name}-ingest-${data.google_project.this.number}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  labels                      = local.labels

  # Abandoned or already-processed uploads are removed automatically.
  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = [var.web_url]
    method          = ["PUT"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket" "media" {
  project                     = var.project_id
  name                        = "${local.name}-media-${data.google_project.this.number}"
  location                    = local.is_prod ? "EU" : var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  labels                      = local.labels

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3
    }
    action {
      type = "Delete"
    }
  }
}

# ---------------------------------------------------------------- Pub/Sub
locals {
  topics = [
    "media.uploaded",
    "media.processed",
    "catalogue.published",
    "social.activity",
    "notifications.dispatch",
    "ai.job.requested",
    "ai.job.completed",
    "payments.webhook.received",
    "analytics.listening",
  ]
}

resource "google_pubsub_topic" "events" {
  for_each                   = toset(local.topics)
  project                    = var.project_id
  name                       = "${local.name}-${replace(each.value, ".", "-")}"
  labels                     = local.labels
  message_retention_duration = "604800s"
  depends_on                 = [google_project_service.apis]
}

resource "google_pubsub_topic" "dead_letter" {
  for_each = toset(local.topics)
  project  = var.project_id
  name     = "${local.name}-${replace(each.value, ".", "-")}-dlq"
  labels   = local.labels
}
