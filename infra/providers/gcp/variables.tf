variable "instance_name" {
  type = string
}

variable "region" {
  type = string
}

variable "project_id" {
  type = string
}

variable "endpoint_exposure" {
  type    = string
  default = "public"
}

variable "api_image" {
  type    = string
  default = "ghcr.io/your-org/query-designer-api:latest"
}

variable "web_image" {
  type    = string
  default = "ghcr.io/your-org/query-designer-web:latest"
}
