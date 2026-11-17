# MusicVerse — production environment.
#   terraform init -backend-config="bucket=<state-bucket>"
#   terraform plan -var-file=prod.tfvars
terraform {
  required_version = ">= 1.6.0"
  backend "gcs" {
    prefix = "musicverse/prod"
  }
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.10"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "image_tag" {
  description = "Image tag or @sha256 digest suffix to deploy."
  type        = string
}

variable "domain" {
  description = "Base domain, e.g. musicverse.app"
  type        = string
}

variable "smtp_host" {
  type = string
}

variable "smtp_user" {
  type    = string
  default = ""
}

variable "google_client_ids" {
  type    = string
  default = ""
}

variable "apple_client_ids" {
  type    = string
  default = ""
}

variable "alert_notification_channels" {
  type    = list(string)
  default = []
}

locals {
  registry = "${var.region}-docker.pkg.dev/${var.project_id}/musicverse-images"
}

module "platform" {
  source      = "../../modules/platform"
  project_id  = var.project_id
  environment = "production"
  region      = var.region

  api_image   = "${local.registry}/api:${var.image_tag}"
  web_image   = "${local.registry}/web:${var.image_tag}"
  admin_image = "${local.registry}/admin:${var.image_tag}"

  web_url        = "https://${var.domain}"
  admin_url      = "https://admin.${var.domain}"
  api_public_url = "https://api.${var.domain}/api/v1"
  media_domain   = "media.${var.domain}"

  smtp_host                   = var.smtp_host
  smtp_user                   = var.smtp_user
  google_client_ids           = var.google_client_ids
  apple_client_ids            = var.apple_client_ids
  alert_notification_channels = var.alert_notification_channels

  db_tier                  = "db-custom-4-15360"
  db_high_availability     = true
  db_backup_retention_days = 30
  redis_tier               = "STANDARD_HA"
  redis_memory_gb          = 5
  api_min_instances        = 2
  api_max_instances        = 50
  web_min_instances        = 1
  admin_public             = false # front with Identity-Aware Proxy
}

output "platform" {
  value = module.platform
}
