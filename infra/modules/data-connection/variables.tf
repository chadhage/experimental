variable "instance_name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }

variable "isolation_mode" {
  type    = string
  default = "shared"
}

variable "data_source_type" {
  type    = string
  default = "sqlserver"
}

variable "data_connectivity" {
  type    = string
  default = "internet" # internet | ipsec
}

variable "data_source_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "private_endpoint_subnet_id" {
  type    = string
  default = ""
}

variable "data_source_resource_id" {
  type    = string
  default = ""
}

variable "data_source_subresources" {
  type    = list(string)
  default = ["sqlServer"]
}

variable "tags" {
  type    = map(string)
  default = {}
}
