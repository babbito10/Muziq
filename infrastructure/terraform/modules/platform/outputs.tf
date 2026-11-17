output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "web_url" {
  value = google_cloud_run_v2_service.frontend["web"].uri
}

output "admin_url" {
  value = google_cloud_run_v2_service.frontend["admin"].uri
}

output "artifact_registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "migrate_job" {
  value = google_cloud_run_v2_job.api["migrate"].name
}

output "buckets" {
  value = { ingest = google_storage_bucket.ingest.name, media = google_storage_bucket.media.name }
}

output "media_cdn_ip" {
  value = var.media_domain == "" ? null : google_compute_global_address.media[0].address
}

output "secrets_requiring_values" {
  description = "Secrets created empty that an operator must populate before the first deploy."
  value       = [for s in google_secret_manager_secret.manual : s.secret_id]
}
