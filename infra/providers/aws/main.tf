# AWS provider stack (Option D) — Designer UI + Publish API on ECS Fargate behind an ALB,
# DynamoDB for tenant metadata, API Gateway as the endpoint gateway, optional Site-to-Site VPN.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.60" }
  }
}

locals {
  name = "qd-${var.instance_name}"
  tags = { instance = var.instance_name, managedBy = "terraform", product = "query-designer" }
}

resource "aws_vpc" "this" {
  cidr_block           = "10.50.0.0/16"
  enable_dns_hostnames = true
  tags                 = local.tags
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(aws_vpc.this.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = local.tags
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_ecs_cluster" "this" {
  name = local.name
  tags = local.tags
}

resource "aws_dynamodb_table" "tenants" {
  name         = "${local.name}-tenants"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenantId"
  attribute {
    name = "tenantId"
    type = "S"
  }
  tags = local.tags
}

# Endpoint gateway
resource "aws_apigatewayv2_api" "endpoints" {
  name          = "${local.name}-endpoints"
  protocol_type = "HTTP"
  tags          = local.tags
}

# Site-to-Site VPN for private connectivity (created when endpoint is private).
resource "aws_vpn_gateway" "this" {
  count  = var.endpoint_exposure == "private" ? 1 : 0
  vpc_id = aws_vpc.this.id
  tags   = local.tags
}

# NOTE: ECS task definitions / services for api_image and web_image are intentionally
# left as a TODO hook so customers can wire their image registry + execution roles.
