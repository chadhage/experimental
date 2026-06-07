# Data-connection module — Key Vault to hold the data source secret, plus optional Private Endpoint
# for IPSec/private connectivity to the customer's source (SQL Server, Databricks, Snowflake, etc).

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.110" }
  }
}

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "this" {
  name                          = substr("kv-${replace(var.instance_name, "-", "")}", 0, 24)
  location                      = var.location
  resource_group_name           = var.resource_group_name
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  purge_protection_enabled      = var.isolation_mode == "isolated"
  enable_rbac_authorization     = true
  public_network_access_enabled = var.data_connectivity != "ipsec"
  tags                          = var.tags
}

# Secret reference holder. The actual value should be injected out-of-band (CI secret / manual).
resource "azurerm_key_vault_secret" "data_source" {
  count        = var.data_source_secret != "" ? 1 : 0
  name         = "datasource-${var.data_source_type}"
  value        = var.data_source_secret
  key_vault_id = azurerm_key_vault.this.id
}

# Private endpoint into the customer source network (only when connectivity is IPSec/private).
resource "azurerm_private_endpoint" "data_source" {
  count               = var.data_connectivity == "ipsec" && var.private_endpoint_subnet_id != "" ? 1 : 0
  name                = "pe-src-${var.instance_name}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoint_subnet_id
  tags                = var.tags

  private_service_connection {
    name                           = "psc-src-${var.instance_name}"
    is_manual_connection           = true
    private_connection_resource_id = var.data_source_resource_id
    subresource_names              = var.data_source_subresources
    request_message                = "QueryDesigner private link to ${var.data_source_type}"
  }
}
