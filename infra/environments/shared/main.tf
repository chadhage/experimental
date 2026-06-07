# Environment: SHARED (Options A & B)
# Consumes generated.auto.tfvars.json produced by the deployment wizard.

terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.110" }
  }
  # Configure a remote backend for production (example below; uncomment & fill in).
  # backend "azurerm" {
  #   resource_group_name  = "rg-tfstate"
  #   storage_account_name = "sttfstateshared"
  #   container_name       = "tfstate"
  #   key                  = "shared.tfstate"
  # }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id != "" ? var.subscription_id : null
  tenant_id       = var.tenant_id != "" ? var.tenant_id : null
}

module "platform" {
  source            = "../../modules/shared"
  instance_name     = var.instance_name
  location          = var.region
  endpoint_exposure = var.endpoint_exposure
  data_source_type  = var.data_source_type
  data_connectivity = var.data_connectivity
  api_image         = var.api_image
  web_image         = var.web_image
}

output "designer_url" { value = module.platform.designer_url }
output "gateway_url" { value = module.platform.gateway_url }
output "metadata_endpoint" { value = module.platform.metadata_endpoint }
