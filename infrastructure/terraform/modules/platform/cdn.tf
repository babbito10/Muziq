# Media delivery: private bucket → Cloud CDN backend bucket with signed URLs (only the API can mint
# them). Created only when media_domain is set (requires DNS for the managed certificate).
resource "random_bytes" "cdn_key" {
  count  = var.media_domain == "" ? 0 : 1
  length = 16
}

resource "google_compute_backend_bucket" "media" {
  count       = var.media_domain == "" ? 0 : 1
  project     = var.project_id
  name        = "${local.name}-media"
  bucket_name = google_storage_bucket.media.name
  enable_cdn  = true
  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    signed_url_cache_max_age_sec = 3600
    default_ttl                  = 3600
  }
}

resource "google_compute_backend_bucket_signed_url_key" "media" {
  count          = var.media_domain == "" ? 0 : 1
  project        = var.project_id
  name           = "${local.name}-media-key"
  key_value      = random_bytes.cdn_key[0].base64
  backend_bucket = google_compute_backend_bucket.media[0].name
}

# Cloud CDN fetches from the private bucket with its own service agent.
resource "google_storage_bucket_iam_member" "cdn_fill" {
  count      = var.media_domain == "" ? 0 : 1
  bucket     = google_storage_bucket.media.name
  role       = "roles/storage.objectViewer"
  member     = "serviceAccount:service-${data.google_project.this.number}@cloud-cdn-fill.iam.gserviceaccount.com"
  depends_on = [google_compute_backend_bucket_signed_url_key.media]
}

resource "google_secret_manager_secret" "cdn_key" {
  count     = var.media_domain == "" ? 0 : 1
  project   = var.project_id
  secret_id = "${local.name}-cdn-signing-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "cdn_key" {
  count       = var.media_domain == "" ? 0 : 1
  secret      = google_secret_manager_secret.cdn_key[0].id
  secret_data = random_bytes.cdn_key[0].base64
}

resource "google_compute_url_map" "media" {
  count           = var.media_domain == "" ? 0 : 1
  project         = var.project_id
  name            = "${local.name}-media"
  default_service = google_compute_backend_bucket.media[0].id
}

resource "google_compute_managed_ssl_certificate" "media" {
  count   = var.media_domain == "" ? 0 : 1
  project = var.project_id
  name    = "${local.name}-media-cert"
  managed {
    domains = [var.media_domain]
  }
}

resource "google_compute_target_https_proxy" "media" {
  count            = var.media_domain == "" ? 0 : 1
  project          = var.project_id
  name             = "${local.name}-media"
  url_map          = google_compute_url_map.media[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.media[0].id]
}

resource "google_compute_global_address" "media" {
  count   = var.media_domain == "" ? 0 : 1
  project = var.project_id
  name    = "${local.name}-media-ip"
}

resource "google_compute_global_forwarding_rule" "media" {
  count                 = var.media_domain == "" ? 0 : 1
  project               = var.project_id
  name                  = "${local.name}-media-https"
  target                = google_compute_target_https_proxy.media[0].id
  ip_address            = google_compute_global_address.media[0].address
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL"
}
