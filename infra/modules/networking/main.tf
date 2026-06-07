# Networking module — VNet, subnets, optional VPN Gateway (IKEv2/IPSec) and Private DNS.
# Used by Options B/C/D for private inbound/outbound.

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.110" }
  }
}

resource "azurerm_virtual_network" "this" {
  name                = "vnet-${var.instance_name}"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = [var.address_space]
  tags                = var.tags
}

resource "azurerm_subnet" "apps" {
  name                 = "snet-apps"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [cidrsubnet(var.address_space, 4, 0)]
}

resource "azurerm_subnet" "private_endpoints" {
  name                 = "snet-pe"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [cidrsubnet(var.address_space, 4, 1)]
}

# GatewaySubnet is required by Azure to host a VPN Gateway and must be named exactly this.
resource "azurerm_subnet" "gateway" {
  count                = var.enable_vpn ? 1 : 0
  name                 = "GatewaySubnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [cidrsubnet(var.address_space, 4, 2)]
}

resource "azurerm_public_ip" "vpn" {
  count               = var.enable_vpn ? 1 : 0
  name                = "pip-vpn-${var.instance_name}"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

# Route-based VPN Gateway supporting IKEv2 / IPSec site-to-site tunnels to the customer.
resource "azurerm_virtual_network_gateway" "vpn" {
  count               = var.enable_vpn ? 1 : 0
  name                = "vpngw-${var.instance_name}"
  location            = var.location
  resource_group_name = var.resource_group_name
  type                = "Vpn"
  vpn_type            = "RouteBased"
  sku                 = "VpnGw1"
  tags                = var.tags

  ip_configuration {
    name                          = "vnetGatewayConfig"
    public_ip_address_id          = azurerm_public_ip.vpn[0].id
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = azurerm_subnet.gateway[0].id
  }
}

resource "azurerm_local_network_gateway" "customer" {
  count               = var.enable_vpn && var.customer_gateway_ip != "" ? 1 : 0
  name                = "lng-${var.instance_name}"
  location            = var.location
  resource_group_name = var.resource_group_name
  gateway_address     = var.customer_gateway_ip
  address_space       = var.customer_address_space
  tags                = var.tags
}

resource "azurerm_virtual_network_gateway_connection" "s2s" {
  count                      = var.enable_vpn && var.customer_gateway_ip != "" ? 1 : 0
  name                       = "cn-${var.instance_name}"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  type                       = "IPsec"
  virtual_network_gateway_id = azurerm_virtual_network_gateway.vpn[0].id
  local_network_gateway_id   = azurerm_local_network_gateway.customer[0].id
  shared_key                 = var.vpn_shared_key
  tags                       = var.tags
}

resource "azurerm_private_dns_zone" "this" {
  count               = var.enable_private_dns ? 1 : 0
  name                = "privatelink.${var.location}.azurecontainerapps.io"
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "this" {
  count                 = var.enable_private_dns ? 1 : 0
  name                  = "link-${var.instance_name}"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.this[0].name
  virtual_network_id    = azurerm_virtual_network.this.id
  tags                  = var.tags
}
