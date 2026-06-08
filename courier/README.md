# Courier — Guided Deployment

Courier is an interactive wizard that walks a deployment invoker through
deploying one of this repository's sample workloads — **Hello World** or
**Dice Roll** — from GitHub to their choice of **Azure**, **AWS**, or **GCP**.

It guides you through a 12-step flow: pick a workload and cloud, sign in with a
**simulated** single sign-on, select a subscription, region, and zones, name the
instance and identify its owner, review everything, then press **Deploy**.
Courier then runs a **simulated** deployment, performs verification checks, and
shows a summary of what was deployed and verified — with links to the empirical
evidence behind each check. Courier never contacts a real cloud, creates real
resources, or stores any credentials; everything is simulated for the demo.

## Requirements

- Node.js 18+ (uses only built-in modules — no `npm install` needed)
- The CLI for your chosen cloud, installed and authenticated if you later adapt
  the generated script for a real deployment: `az`, `aws`, or `gcloud`

## Run the wizard

Courier offers two front ends that share the same workload/cloud definitions,
simulated sign-in, validation, deployment, and verification.

### Web UI (browser)

```bash
cd courier
npm run web
# then open http://localhost:4173
```

A guided stepper walks you through each step with clickable cards, radio lists,
and selectable zone chips. After you press **Deploy**, the resources and
verification checks stream in live, then a summary page shows what was deployed
and verified, with expandable **evidence** panels and a **Download evidence
bundle** button.

### CLI wizard (terminal)

```bash
cd courier
npm start
# or: node wizard.js
```

## Guided flow

1. **Select workload to deploy** — Hello World or Dice Roll.
2. **Select cloud to deploy to** — Azure, AWS, or GCP.
3. **Sign in to cloud using SSO** — a **simulated** sign-on. Courier never
   contacts a real identity provider; it returns a mock identity
   (`Casey Deployer`) and the subscriptions/accounts/projects for the cloud.
4. **Select subscription to deploy to** — pick from the signed-in account's
   subscriptions (Azure), accounts (AWS), or projects (GCP).
5. **Select region to deploy to** — pick from the cloud's regions.
6. **Select zones to deploy to** — pick one or more availability zones in the
   chosen region.
7. **Specify instance name** — 4-40 chars: lowercase letters, digits, hyphens;
   starts with a letter (prefilled as `<workload>-demo`).
8. **Specify the instance owner name and email** — prefilled from the signed-in
   identity; the email is validated.
9. **Display a confirmation of all inputs** — review everything before
   deploying.
10. **Deploy** — press Deploy to start the (simulated) deployment.
11. **Perform deployment checks** — Courier simulates provisioning each resource
    and runs verification checks (reachability, health probe, zone redundancy,
    storage wiring, owner tags).
12. **Deployment summary** — a page summarizing what was deployed and what was
    verified, with links to the empirical evidence (command output, HTTP traces,
    and logs) and an overall confidence rating.

Each value is validated and re-prompted until valid. The cloud's own terminology
is used throughout (Azure: *Subscription / Region / Availability zone*; AWS:
*Account / Region / Availability zone*; GCP: *Project / Region / Zone*).

> **Simulated deployment:** Courier's SSO, deployment, and verification steps are
> demo stand-ins. No cloud is contacted, no resources are created, and no
> credentials are collected or stored. The evidence is illustrative sample data.

## Output

The CLI writes three files to `courier/out/` after a deployment:

- `<instance>-<cloud>-<timestamp>.plan.json` — the captured answers/plan
- `<instance>-<cloud>-<timestamp>.deploy.sh` — the deployment commands
- `<instance>-<cloud>-<timestamp>.evidence.txt` — the verification evidence

The web UI offers the same evidence bundle via the **Download evidence bundle**
button on the summary page.

## Project layout

```
courier/
  wizard.js          Interactive CLI entrypoint
  web/
    server.js        HTTP server + JSON API (options, signin, plan, deploy)
    public/          Browser stepper UI (index.html, app.js, styles.css)
  lib/
    prompt.js        Readline prompts with validation (single + multi select)
    workloads.js     Deployable workload definitions
    clouds.js        Cloud targets, terminology, subscriptions, regions, zones
    auth.js          Simulated single sign-on
    validate.js      Shared selection validation (CLI + web)
    plan.js          Plan + command generation
    deploy.js        Simulated deployment, verification checks, and evidence
  out/               Generated plans, scripts, and evidence (git-ignored)
```
