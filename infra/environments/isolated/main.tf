# Environment: ISOLATED (Option C) — dedicated subscription in OUR cloud.

terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.110" }
  }
  # backend "azurerm" { ... per-customer state ... }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
  tenant_id       = var.tenant_id != "" ? var.tenant_id : null
}

module "platform" {
  source            = "../../modules/isolated"
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
output "vpn_public_ip" { value = module.platform.vpn_public_ip }
output "metadata_endpoint" { value = module.platform.metadata_endpoint }
