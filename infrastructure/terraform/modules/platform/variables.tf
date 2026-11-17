variable "project_id" {
  description = "GCP project for this environment (one project per environment)."
  type        = string
}

variable "environment" {
  description = "development | staging | production"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be development, staging or production."
  }
}

variable "region" {
  description = "Primary region."
  type        = string
  default     = "europe-west1"
}

variable "name_prefix" {
  description = "Prefix for resource names."
  type        = string
  default     = "musicverse"
}

# ---------------------------------------------------------------- images
variable "api_image" {
  description = "Fully qualified API image (Artifact Registry), ideally pinned by digest."
  type        = string
}

variable "web_image" {
  type = string
}

variable "admin_image" {
  type = string
}

# ---------------------------------------------------------------- public URLs
variable "web_url" {
  description = "Public URL of the web app, e.g. https://musicverse.app (email links, CORS)."
  type        = string
}

variable "admin_url" {
  description = "Public URL of the admin console (CORS)."
  type        = string
}

variable "api_public_url" {
  description = "Public API base URL used by browsers, e.g. https://api.musicverse.app/api/v1."
  type        = string
}

variable "media_domain" {
  description = "Domain for CDN media delivery (e.g. media.musicverse.app). Empty disables the CDN load balancer."
  type        = string
  default     = ""
}

# ---------------------------------------------------------------- sizing
variable "db_tier" {
  type    = string
  default = "db-custom-1-3840"
}

variable "db_high_availability" {
  type    = bool
  default = false
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "db_deletion_protection" {
  type    = bool
  default = true
}

variable "redis_tier" {
  description = "BASIC or STANDARD_HA"
  type        = string
  default     = "BASIC"
}

variable "redis_memory_gb" {
  type    = number
  default = 1
}

variable "api_min_instances" {
  type    = number
  default = 0
}

variable "api_max_instances" {
  type    = number
  default = 10
}

variable "web_min_instances" {
  type    = number
  default = 0
}

# ---------------------------------------------------------------- app config (non-secret)
variable "mail_from" {
  type    = string
  default = "MusicVerse <no-reply@musicverse.app>"
}

variable "smtp_host" {
  description = "SMTP host of the transactional email provider. The password goes in Secret Manager (smtp-password)."
  type        = string
}

variable "smtp_port" {
  type    = number
  default = 587
}

variable "smtp_user" {
  type    = string
  default = ""
}

variable "google_client_ids" {
  description = "Comma-separated Google OAuth client IDs (empty disables Google sign-in)."
  type        = string
  default     = ""
}

variable "apple_client_ids" {
  description = "Comma-separated Apple Services/bundle IDs (empty disables Sign in with Apple)."
  type        = string
  default     = ""
}

variable "admin_public" {
  description = "Allow unauthenticated invocation of the admin service. Keep false in production and front it with IAP."
  type        = bool
  default     = false
}

variable "alert_notification_channels" {
  description = "Cloud Monitoring notification channel IDs for alerts."
  type        = list(string)
  default     = []
}
