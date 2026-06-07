variable "instance_name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }

variable "isolation_mode" {
  type    = string
  default = "shared" # shared | isolated
}

variable "endpoint_exposure" {
  type    = string
  default = "public" # public | private
}

variable "infra_subnet_id" {
  type    = string
  default = ""
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

variable "publisher_name" {
  type    = string
  default = "Query Designer"
}

variable "publisher_email" {
  type    = string
  default = "ops@example.com"
}

variable "tags" {
  type    = map(string)
  default = {}
}
