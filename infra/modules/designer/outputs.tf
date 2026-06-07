output "designer_url" {
  value = "https://${azurerm_container_app.web.ingress[0].fqdn}"
}

output "api_url" {
  value = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}

output "gateway_url" {
  value = azurerm_api_management.this.gateway_url
}

output "container_app_environment_id" {
  value = azurerm_container_app_environment.this.id
}
