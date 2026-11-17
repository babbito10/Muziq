resource "google_monitoring_uptime_check_config" "api_ready" {
  project      = var.project_id
  display_name = "${local.name} API readiness"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/api/v1/health/ready"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = trimsuffix(trimprefix(google_cloud_run_v2_service.api.uri, "https://"), "/")
    }
  }
}

resource "google_monitoring_alert_policy" "api_down" {
  project               = var.project_id
  display_name          = "${local.name} API unavailable"
  combiner              = "OR"
  notification_channels = var.alert_notification_channels

  conditions {
    display_name = "Readiness check failing"
    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"${google_monitoring_uptime_check_config.api_ready.uptime_check_id}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "300s"
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.*"]
      }
    }
  }
}

resource "google_monitoring_alert_policy" "api_5xx" {
  project               = var.project_id
  display_name          = "${local.name} API 5xx rate"
  combiner              = "OR"
  notification_channels = var.alert_notification_channels

  conditions {
    display_name = "5xx responses > 5/min for 5 minutes"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${google_cloud_run_v2_service.api.name}\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
}
