# Environment: BYO (Option D) — deploy into the CUSTOMER's own tenant/account on Azure, AWS, or GCP.
# The `cloud` variable selects which provider stack is activated. Only one runs per apply.

terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.110" }
    aws     = { source = "hashicorp/aws", version = "~> 5.60" }
    google  = { source = "hashicorp/google", version = "~> 5.40" }
  }
}

# ---- Azure (customer tenant) ----------------------------------------------------------
provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
  tenant_id       = var.tenant_id != "" ? var.tenant_id : null
}

module "azure" {
  count             = var.cloud == "azure" ? 1 : 0
  source            = "../../modules/isolated"
  instance_name     = var.instance_name
  location          = var.region
  endpoint_exposure = var.endpoint_exposure
  data_source_type  = var.data_source_type
  data_connectivity = var.data_connectivity
  api_image         = var.api_image
  web_image         = var.web_image
}

# ---- AWS (customer account) -----------------------------------------------------------
provider "aws" {
  region = var.region
  # Credentials resolved from the customer's profile / assumed role (credentialRef).
}

module "aws" {
  count             = var.cloud == "aws" ? 1 : 0
  source            = "../../providers/aws"
  instance_name     = var.instance_name
  region            = var.region
  endpoint_exposure = var.endpoint_exposure
  api_image         = var.api_image
  web_image         = var.web_image
}

# ---- GCP (customer project) -----------------------------------------------------------
provider "google" {
  project = var.subscription_id # GCP project id passed as subscription_id by the wizard
  region  = var.region
}

module "gcp" {
  count             = var.cloud == "gcp" ? 1 : 0
  source            = "../../providers/gcp"
  instance_name     = var.instance_name
  region            = var.region
  project_id        = var.subscription_id
  endpoint_exposure = var.endpoint_exposure
  api_image         = var.api_image
  web_image         = var.web_image
}

output "designer_url" {
  value = coalesce(
    try(module.azure[0].designer_url, ""),
    try(module.aws[0].designer_url, ""),
    try(module.gcp[0].designer_url, ""),
  )
}
