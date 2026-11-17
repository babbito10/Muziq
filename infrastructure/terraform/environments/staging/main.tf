# MusicVerse — staging environment.
#   terraform init -backend-config="bucket=<state-bucket>"
#   terraform plan -var-file=staging.tfvars
terraform {
  required_version = ">= 1.6.0"
  backend "gcs" {
    prefix = "musicverse/staging"
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
  environment = "staging"
  region      = var.region

  api_image   = "${local.registry}/api:${var.image_tag}"
  web_image   = "${local.registry}/web:${var.image_tag}"
  admin_image = "${local.registry}/admin:${var.image_tag}"

  web_url        = "https://staging.${var.domain}"
  admin_url      = "https://admin.staging.${var.domain}"
  api_public_url = "https://api.staging.${var.domain}/api/v1"
  media_domain   = "media.staging.${var.domain}"

  smtp_host                   = var.smtp_host
  smtp_user                   = var.smtp_user
  google_client_ids           = var.google_client_ids
  apple_client_ids            = var.apple_client_ids
  alert_notification_channels = var.alert_notification_channels

  db_tier                  = "db-custom-2-7680"
  db_high_availability     = false
  db_backup_retention_days = 7
  redis_tier               = "BASIC"
  api_min_instances        = 1
  api_max_instances        = 10
  admin_public             = false
}

output "platform" {
  value = module.platform
}
