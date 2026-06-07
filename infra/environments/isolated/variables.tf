# Isolated variables — populated by the wizard's generated.auto.tfvars.json.

variable "instance_name" {
  type    = string
  default = "contoso-prod"
}

variable "isolation" {
  type    = string
  default = "C"
}

variable "designer_surface" {
  type    = string
  default = "web"
}

variable "region" {
  type    = string
  default = "eastus2"
}

variable "cloud" {
  type    = string
  default = "azure"
}

variable "tenant_id" {
  type    = string
  default = ""
}

variable "subscription_id" {
  type = string
}

variable "data_source_type" {
  type    = string
  default = "sqlserver"
}

variable "data_connectivity" {
  type    = string
  default = "ipsec"
}

variable "data_source_host" {
  type    = string
  default = ""
}

variable "endpoint_exposure" {
  type    = string
  default = "private"
}

variable "api_image" {
  type    = string
  default = "ghcr.io/your-org/query-designer-api:latest"
}

variable "web_image" {
  type    = string
  default = "ghcr.io/your-org/query-designer-web:latest"
}
