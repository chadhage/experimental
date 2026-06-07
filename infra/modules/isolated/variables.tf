variable "instance_name" {
  type = string
}

variable "location" {
  type = string
}

variable "endpoint_exposure" {
  type    = string
  default = "private"
}

variable "data_source_type" {
  type    = string
  default = "sqlserver"
}

variable "data_connectivity" {
  type    = string
  default = "ipsec"
}

variable "data_source_resource_id" {
  type    = string
  default = ""
}

variable "customer_gateway_ip" {
  type    = string
  default = ""
}

variable "vpn_shared_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "api_image" {
  type    = string
  default = "ghcr.io/your-org/query-designer-api:latest"
}

variable "web_image" {
  type    = string
  default = "ghcr.io/your-org/query-designer-web:latest"
}

variable "api_access_token" {
  type      = string
  default   = "dev-token"
  sensitive = true
}

variable "publisher_email" {
  type    = string
  default = "ops@example.com"
}

variable "tags" {
  type    = map(string)
  default = {}
}
