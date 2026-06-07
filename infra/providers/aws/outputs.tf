output "designer_url" {
  value = aws_apigatewayv2_api.endpoints.api_endpoint
}

output "metadata_table" {
  value = aws_dynamodb_table.tenants.name
}
