# Isolated tier composition (Option C, and the building block for Option D).
# Everything is dedicated: resource group, network, metadata store, compute, gateway, secrets.

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.110" }
  }
}

locals {
  tags = merge(var.tags, {
    tier      = "isolated"
    instance  = var.instance_name
    managedBy = "terraform"
  })
}

resource "azurerm_resource_group" "this" {
  name     = "rg-iso-${var.instance_name}"
  location = var.location
  tags     = local.tags
}

# Dedicated network — always present for isolation; VPN enabled when IPSec is required.
module "networking" {
  source              = "../networking"
  instance_name       = var.instance_name
  location            = var.location
  resource_group_name = azurerm_resource_group.this.name
  enable_vpn          = var.data_connectivity == "ipsec" || var.endpoint_exposure == "private"
  enable_private_dns  = true
  customer_gateway_ip = var.customer_gateway_ip
  vpn_shared_key      = var.vpn_shared_key
  tags                = local.tags
}

# Dedicated metadata store — 100% isolated from other customers.
resource "azurerm_cosmosdb_account" "meta" {
  name                = substr("cosmos-iso-${replace(var.instance_name, "-", "")}", 0, 44)
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"
  consistency_policy { consistency_level = "Session" }
  geo_location {
    location          = azurerm_resource_group.this.location
    failover_priority = 0
  }
  is_virtual_network_filter_enabled = true
  tags                              = local.tags
}

resource "azurerm_cosmosdb_sql_database" "meta" {
  name                = "designer"
  resource_group_name = azurerm_resource_group.this.name
  account_name        = azurerm_cosmosdb_account.meta.name
}

resource "azurerm_cosmosdb_sql_container" "tenants" {
  name                  = "tenants"
  resource_group_name   = azurerm_resource_group.this.name
  account_name          = azurerm_cosmosdb_account.meta.name
  database_name         = azurerm_cosmosdb_sql_database.meta.name
  partition_key_paths   = ["/tenantId"]
  partition_key_version = 2
}

module "designer" {
  source              = "../designer"
  instance_name       = var.instance_name
  location            = var.location
  resource_group_name = azurerm_resource_group.this.name
  isolation_mode      = "isolated"
  endpoint_exposure   = var.endpoint_exposure
  infra_subnet_id     = module.networking.apps_subnet_id
  api_image           = var.api_image
  web_image           = var.web_image
  api_access_token    = var.api_access_token
  publisher_email     = var.publisher_email
  tags                = local.tags
}

module "data_connection" {
  source                     = "../data-connection"
  instance_name              = var.instance_name
  location                   = var.location
  resource_group_name        = azurerm_resource_group.this.name
  isolation_mode             = "isolated"
  data_source_type           = var.data_source_type
  data_connectivity          = var.data_connectivity
  private_endpoint_subnet_id = module.networking.private_endpoint_subnet_id
  data_source_resource_id    = var.data_source_resource_id
  tags                       = local.tags
}
