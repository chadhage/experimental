# Deployment Options — Component Matrix

Each option provisions a superset of the previous one. The wizard selects the right Terraform
environment stack based on the customer's answers.

## Option A — Shared everything (public endpoint)

**Use when:** lowest cost, fastest onboarding, customer accepts multi-tenant data + compute.

| Component | Azure service | Isolation |
|-----------|---------------|-----------|
| Designer UI | App Service (shared plan) / Static Web App | Namespaced per tenant |
| Publish API | Container Apps (shared environment) | Namespaced per tenant |
| Tenant metadata | Cosmos DB (shared, partitioned by `tenantId`) | Logical (partition key) |
| Published endpoints | API Management (shared) | Subscription key per tenant |
| Secrets | Key Vault (shared, RBAC per tenant) | Logical (RBAC) |
| Data connection | Outbound to customer source over public internet | n/a |
| AuthN/Z | Entra ID + per-endpoint access token | Token scope |

## Option B — Shared compute, optional private inbound

**Use when:** customer wants the published endpoint reachable over VPN/IPSec, but accepts shared compute.

Adds to Option A:

| Component | Azure service | Purpose |
|-----------|---------------|---------|
| Private inbound | Private Endpoint + Private Link Service | Expose published endpoint privately |
| VPN | VPN Gateway (route-based, IKEv2/IPSec) | Site-to-site to customer |
| DNS | Private DNS Zone | Resolve private endpoint |

## Option C — Fully isolated, our cloud

**Use when:** contractual 100% data + compute isolation, but you still operate it.

Replaces shared services with **dedicated, per-customer** ones inside a **dedicated subscription**:

| Component | Azure service | Isolation |
|-----------|---------------|-----------|
| Subscription | Dedicated subscription (per customer) | Hard |
| Network | Dedicated VNet + NSGs | Hard |
| Designer UI | Dedicated App Service plan | Hard |
| Publish API | Dedicated Container Apps environment | Hard |
| Tenant metadata | Dedicated Cosmos DB / SQL | Hard |
| Endpoints | Dedicated API Management | Hard |
| Secrets | Dedicated Key Vault | Hard |
| Private inbound/outbound | Dedicated VPN Gateway + Private Endpoints | Hard |

## Option D — Customer's own tenant & cloud (BYO)

**Use when:** customer requires the product to live entirely in **their** Azure/AWS/GCP account.

Same logical components as Option C, but:

- Terraform authenticates against the **customer's** cloud credentials (service principal / IAM role /
  workload identity) supplied during the wizard.
- State is stored in a backend the customer controls (or a delegated one).
- A handoff runbook transfers operational ownership.

| Cloud | Compute | Metadata store | Endpoint gateway | Private network |
|-------|---------|----------------|------------------|-----------------|
| Azure | Container Apps | Cosmos DB / SQL | API Management | VNet + VPN Gateway |
| AWS | ECS Fargate | DynamoDB / RDS | API Gateway | VPC + Site-to-Site VPN |
| GCP | Cloud Run | Firestore / Cloud SQL | API Gateway | VPC + Cloud VPN |

## Cross-cutting components (all options)

- **Identity:** Entra ID (Azure), IAM (AWS), IAM (GCP) for control-plane; per-endpoint bearer tokens for data-plane.
- **Observability:** App Insights / CloudWatch / Cloud Logging.
- **CI/CD:** GitHub Actions builds images, pushes to registry, runs `terraform apply`.
- **Data connections:** SQL Server, Databricks, SharePoint, Excel Online, Snowflake — modeled as a
  `data-connection` Terraform module + runtime connector config in the API.
