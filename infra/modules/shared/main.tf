# Shared tier composition (Options A & B).
# Compute and data live side-by-side with other tenants; isolation is logical (partition key + RBAC).

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.110" }
  }
}

locals {
  tags = merge(var.tags, {
    tier      = "shared"
    instance  = var.instance_name
    managedBy = "terraform"
  })
}

resource "azurerm_resource_group" "this" {
  name     = "rg-shared-${var.instance_name}"
  location = var.location
  tags     = local.tags
}

# Shared tenant-metadata store. Tenants are isolated by partition key (/tenantId).
resource "azurerm_cosmosdb_account" "meta" {
  name                = substr("cosmos-shared-${replace(var.instance_name, "-", "")}", 0, 44)
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"
  consistency_policy { consistency_level = "Session" }
  geo_location {
    location          = azurerm_resource_group.this.location
    failover_priority = 0
  }
  tags = local.tags
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

# Optional networking only when a private endpoint is requested (Option B).
module "networking" {
  count               = var.endpoint_exposure == "private" ? 1 : 0
  source              = "../networking"
  instance_name       = var.instance_name
  location            = var.location
  resource_group_name = azurerm_resource_group.this.name
  enable_vpn          = var.data_connectivity == "ipsec"
  enable_private_dns  = true
  tags                = local.tags
}

module "designer" {
  source              = "../designer"
  instance_name       = var.instance_name
  location            = var.location
  resource_group_name = azurerm_resource_group.this.name
  isolation_mode      = "shared"
  endpoint_exposure   = var.endpoint_exposure
  infra_subnet_id     = var.endpoint_exposure == "private" ? module.networking[0].apps_subnet_id : ""
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
  isolation_mode             = "shared"
  data_source_type           = var.data_source_type
  data_connectivity          = var.data_connectivity
  private_endpoint_subnet_id = var.endpoint_exposure == "private" ? module.networking[0].private_endpoint_subnet_id : ""
  tags                       = local.tags
}
