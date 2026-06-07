output "designer_url" {
  value = module.designer.designer_url
}

output "api_url" {
  value = module.designer.api_url
}

output "gateway_url" {
  value = module.designer.gateway_url
}

output "metadata_endpoint" {
  value = azurerm_cosmosdb_account.meta.endpoint
}

output "key_vault_uri" {
  value = module.data_connection.key_vault_uri
}
