# Deployment User Flow

After purchase, the customer launches the wizard. It asks **one question per turn** and stores answers
in `deploy/answers.json`. Branches are driven by the **isolation** answer.

```mermaid
flowchart TD
    Q1[Q1: Product instance name?] --> Q2[Q2: Isolation model? A/B/C/D]
    Q2 -->|A or B| SHARED
    Q2 -->|C| ISO
    Q2 -->|D| BYO

    subgraph SHARED[Shared hosting & data]
        S1[Q: Designer surface? web/app/vscode]
        S2[Q: Data source type?]
        S3[Q: Data source connection details]
        S4[Q: Endpoint exposure? public/private]
        S1-->S2-->S3-->S4
    end

    subgraph ISO[Isolated - our cloud]
        I1[Q: Dedicated subscription id?]
        I2[Q: Region?]
        I3[Q: Data source + connectivity internet/IPSec]
        I4[Q: Endpoint exposure? public/private]
        I1-->I2-->I3-->I4
    end

    subgraph BYO[Customer cloud]
        B1[Q: Cloud? azure/aws/gcp]
        B2[Q: Tenant/account id]
        B3[Q: Credentials reference]
        B4[Q: Region]
        B5[Q: Data source + connectivity]
        B6[Q: Endpoint exposure?]
        B1-->B2-->B3-->B4-->B5-->B6
    end

    SHARED --> APPLY[terraform apply -> deploy code -> prepare designer]
    ISO --> APPLY
    BYO --> APPLY
    APPLY --> DONE[Designer ready -> customer publishes endpoint]
```

## Questions collected

| # | Key | Asked when | Example |
|---|-----|-----------|---------|
| 1 | `instanceName` | always | `contoso-prod` |
| 2 | `isolation` | always | `A` / `B` / `C` / `D` |
| 3 | `designerSurface` | always | `web` / `app` / `vscode` |
| 4 | `cloud` | D | `azure` / `aws` / `gcp` |
| 5 | `tenantId` | C, D | `00000000-...` |
| 6 | `subscriptionId` | C, D | `11111111-...` |
| 7 | `credentialRef` | D | `kv://customer-sp` |
| 8 | `region` | always | `eastus2` |
| 9 | `dataSourceType` | always | `sqlserver` / `databricks` / `snowflake` / `sharepoint` / `excelonline` |
| 10 | `dataConnectivity` | B, C, D | `internet` / `ipsec` |
| 11 | `dataSourceHost` | always | `sql.contoso.com` |
| 12 | `endpointExposure` | always | `public` / `private` |

## What happens after the last answer

1. Wizard validates answers and writes `deploy/answers.json`.
2. Wizard maps `isolation` → Terraform environment:
   - `A`/`B` → `infra/environments/shared`
   - `C` → `infra/environments/isolated`
   - `D` → `infra/environments/byo`
3. Runs `terraform init && terraform apply -var-file=<generated>.tfvars.json`.
4. Builds & pushes the app images (or reuses prebuilt ones).
5. Seeds the designer config so the UI is ready.
6. Prints the Designer URL and the (eventual) published-endpoint base URL.
