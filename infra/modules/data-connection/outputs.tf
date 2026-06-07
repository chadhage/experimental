output "key_vault_id" { value = azurerm_key_vault.this.id }
output "key_vault_uri" { value = azurerm_key_vault.this.vault_uri }
output "private_endpoint_ip" {
  value = var.data_connectivity == "ipsec" && var.private_endpoint_subnet_id != "" ? azurerm_private_endpoint.data_source[0].private_service_connection[0].private_ip_address : ""
}
