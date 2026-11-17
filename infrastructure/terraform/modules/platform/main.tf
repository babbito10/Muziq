locals {
  name    = "${var.name_prefix}-${var.environment}"
  is_prod = var.environment == "production"
  labels  = { app = "musicverse", environment = var.environment, managed_by = "terraform" }
  services = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "secretmanager.googleapis.com",
    "pubsub.googleapis.com",
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "monitoring.googleapis.com",
    "cloudscheduler.googleapis.com",
    "iam.googleapis.com",
  ]
}

data "google_project" "this" {
  project_id = var.project_id
}

resource "google_project_service" "apis" {
  for_each           = toset(local.services)
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# ---------------------------------------------------------------- networking
resource "google_compute_network" "vpc" {
  project                 = var.project_id
  name                    = "${local.name}-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "run" {
  project                  = var.project_id
  name                     = "${local.name}-run"
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = "10.10.0.0/24"
  private_ip_google_access = true
}

# Private services access for Cloud SQL (private IP only — no public IP).
resource "google_compute_global_address" "private_services" {
  project       = var.project_id
  name          = "${local.name}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

# ---------------------------------------------------------------- Artifact Registry
resource "google_artifact_registry_repository" "images" {
  project       = var.project_id
  location      = var.region
  repository_id = "${var.name_prefix}-images"
  format        = "DOCKER"
  labels        = local.labels
  depends_on    = [google_project_service.apis]
}
