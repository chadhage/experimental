variable "instance_name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }

variable "address_space" {
  type    = string
  default = "10.40.0.0/20"
}

variable "enable_vpn" {
  type    = bool
  default = false
}

variable "enable_private_dns" {
  type    = bool
  default = false
}

variable "customer_gateway_ip" {
  type    = string
  default = ""
}

variable "customer_address_space" {
  type    = list(string)
  default = ["192.168.0.0/24"]
}

variable "vpn_shared_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
