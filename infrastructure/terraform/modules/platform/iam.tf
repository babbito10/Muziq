# Least-privilege runtime identities: one service account per workload.
resource "google_service_account" "api" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-${substr(var.environment, 0, 4)}-api"
  display_name = "MusicVerse API (${var.environment})"
}

resource "google_service_account" "frontend" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-${substr(var.environment, 0, 4)}-frontend"
  display_name = "MusicVerse web/admin (${var.environment})"
}

resource "google_service_account" "scheduler" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-${substr(var.environment, 0, 4)}-scheduler"
  display_name = "MusicVerse Cloud Scheduler invoker (${var.environment})"
}

resource "google_secret_manager_secret_iam_member" "api" {
  for_each  = local.secret_ids
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/pubsub.publisher",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/cloudtrace.agent",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_storage_bucket_iam_member" "api_ingest" {
  bucket = google_storage_bucket.ingest.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_storage_bucket_iam_member" "api_media" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

# The API signs V4 upload URLs with its own identity (no exported keys).
resource "google_service_account_iam_member" "api_sign_blobs" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "frontend_roles" {
  for_each = toset(["roles/logging.logWriter", "roles/monitoring.metricWriter"])
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.frontend.email}"
}
