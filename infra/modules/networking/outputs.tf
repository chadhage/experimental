output "vnet_id" { value = azurerm_virtual_network.this.id }
output "apps_subnet_id" { value = azurerm_subnet.apps.id }
output "private_endpoint_subnet_id" { value = azurerm_subnet.private_endpoints.id }
output "vpn_gateway_id" { value = var.enable_vpn ? azurerm_virtual_network_gateway.vpn[0].id : "" }
output "vpn_public_ip" { value = var.enable_vpn ? azurerm_public_ip.vpn[0].ip_address : "" }
