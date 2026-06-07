# GCP provider stack (Option D) — Designer UI + Publish API on Cloud Run, Firestore for tenant
# metadata, API Gateway as the endpoint gateway, optional Cloud VPN for private connectivity.

terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.40" }
  }
}

locals {
  name = "qd-${var.instance_name}"
}

resource "google_cloud_run_v2_service" "api" {
  name     = "${local.name}-api"
  location = var.region
  ingress  = var.endpoint_exposure == "private" ? "INGRESS_TRAFFIC_INTERNAL_ONLY" : "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = var.api_image
      ports {
        container_port = 8080
      }
      env {
        name  = "Api__AccessToken"
        value = "dev-token"
      }
    }
  }
}

resource "google_cloud_run_v2_service" "web" {
  name     = "${local.name}-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = var.web_image
      ports {
        container_port = 80
      }
    }
  }
}

resource "google_firestore_database" "meta" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
}

resource "google_compute_network" "this" {
  name                    = "${local.name}-vpc"
  auto_create_subnetworks = true
}

resource "google_compute_vpn_gateway" "this" {
  count   = var.endpoint_exposure == "private" ? 1 : 0
  name    = "${local.name}-vpn"
  network = google_compute_network.this.id
  region  = var.region
}
