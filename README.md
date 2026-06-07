# Query Designer SaaS — Multi-Tenancy Deployment Platform

This repository contains **everything required to deploy the "Query Designer" product** in four
isolation/residency models (Options A–D from the product brief), plus **sample applications** you can
drop in place of your real product code.

| Option | Hosting | Data residency | Network exposure | Where it runs |
|--------|---------|----------------|------------------|---------------|
| **A** | Shared compute | Shared (side-by-side) | Public HTTPS + token | Our cloud |
| **B** | Shared compute | Shared (side-by-side) | Public **or** private VPN/IPSec | Our cloud |
| **C** | **Isolated** compute | **Isolated** (100%) | Public **or** private VPN/IPSec | Our cloud, dedicated tenant/sub |
| **D** | **Isolated** compute | **Isolated** (100%) | Public **or** private VPN/IPSec | **Customer's** tenant/sub (Azure/AWS/GCP) |

## What's in the box

```
.
├── apps/                  Sample product code (swap for your real app)
│   ├── designer-web/      Designer UI — React + TypeScript + Vite
│   ├── designer-vscode/   Designer UI — VS Code extension surface
│   ├── demo-spa/          Self-contained SPA that walks the deployment flows
│   ├── api/               Publish/endpoint API — C# .NET minimal API
│   └── sample-data/       T-SQL seed for a demo SQL data source
├── infra/                 Terraform — modular, multi-cloud, multi-tenant
│   ├── modules/           Reusable building blocks
│   ├── environments/      One stack per Option (shared/isolated/byo)
│   └── providers/         Azure / AWS / GCP provider wiring
├── deploy/                Interactive deployment wizard (the "user flow")
│   ├── wizard.ps1         1-question-per-turn PowerShell experience
│   ├── wizard.sh          Bash equivalent
│   └── answers.example.json
├── .github/workflows/     CI + CD (GitHub Actions)
└── docker-compose.yml     Local end-to-end run
```

## Quick start

### 0. Walk the deployment flows in a browser (no install)

Open [apps/demo-spa/index.html](apps/demo-spa/index.html) directly in a browser (or serve the
folder with any static server). The SPA reproduces the wizard's **one-question-per-turn** flow,
branches on the isolation choice (A/B/C/D), then shows the generated `answers.json`, the Terraform
`tfvars`, the deployment plan, and a simulated provisioning run. Ideal for demos.

### 1. Run the product locally (no cloud)

```bash
docker compose up --build
# Designer UI  -> http://localhost:5173
# Publish API  -> http://localhost:8080/swagger
# SQL Server   -> localhost:1433  (sa / Your_password123!)
```

### 2. Deploy to the cloud (interactive)

```powershell
# Windows / PowerShell
./deploy/wizard.ps1
```

```bash
# Linux / macOS
./deploy/wizard.sh
```

The wizard asks **one question per turn**, collects your answers, writes `deploy/answers.json`,
and then drives Terraform for the option you chose. See [docs/user-flow.md](docs/user-flow.md).

## Documentation

- [docs/deployment-options.md](docs/deployment-options.md) — detailed option matrix & component list
- [docs/architecture.md](docs/architecture.md) — reference architecture & diagrams
- [docs/user-flow.md](docs/user-flow.md) — the question-by-question deployment flow

## Prerequisites

| Tool | Version | Used for |
|------|---------|----------|
| Terraform | ≥ 1.6 | Infrastructure |
| Azure CLI | ≥ 2.60 | Azure auth/deploy |
| AWS CLI / gcloud | latest | Option D on AWS/GCP |
| .NET SDK | 8.0 | API build |
| Node.js | ≥ 20 | Designer UI build |
| Docker | ≥ 24 | Container builds & local run |
| PowerShell | ≥ 7.2 | Wizard (cross-platform) |

> **Security note:** All sample passwords/tokens are placeholders. Replace them with secrets stored
> in your secret manager (Azure Key Vault / AWS Secrets Manager / GCP Secret Manager) before any real
> deployment. Never commit real credentials.
