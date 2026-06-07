# Designer module — provisions the Designer UI + Publish API compute and the endpoint gateway.
# Works for both shared and isolated tiers; pass infra_subnet_id to make it network-integrated.

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.110" }
  }
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "log-${var.instance_name}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

# Container Apps environment hosts both the API and (optionally) the web designer.
resource "azurerm_container_app_environment" "this" {
  name                           = "cae-${var.instance_name}"
  location                       = var.location
  resource_group_name            = var.resource_group_name
  log_analytics_workspace_id     = azurerm_log_analytics_workspace.this.id
  infrastructure_subnet_id       = var.infra_subnet_id != "" ? var.infra_subnet_id : null
  internal_load_balancer_enabled = var.endpoint_exposure == "private"
  tags                           = var.tags
}

# Publish API
resource "azurerm_container_app" "api" {
  name                         = "ca-api-${var.instance_name}"
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  template {
    min_replicas = var.isolation_mode == "isolated" ? 1 : 0
    max_replicas = 5
    container {
      name   = "api"
      image  = var.api_image
      cpu    = 0.5
      memory = "1Gi"
      env {
        name  = "Api__AccessToken"
        value = var.api_access_token
      }
    }
  }

  ingress {
    external_enabled = var.endpoint_exposure == "public"
    target_port      = 8080
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

# Designer web UI
resource "azurerm_container_app" "web" {
  name                         = "ca-web-${var.instance_name}"
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  template {
    min_replicas = 1
    max_replicas = 3
    container {
      name   = "web"
      image  = var.web_image
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 80
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

# Endpoint gateway (API Management) — fronts published endpoints with token auth / rate limiting.
resource "azurerm_api_management" "this" {
  name                = "apim-${var.instance_name}"
  location            = var.location
  resource_group_name = var.resource_group_name
  publisher_name      = var.publisher_name
  publisher_email     = var.publisher_email
  sku_name            = var.isolation_mode == "isolated" ? "Developer_1" : "Consumption_0"
  tags                = var.tags
}
