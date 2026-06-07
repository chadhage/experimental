#!/usr/bin/env bash
# Query Designer SaaS deployment wizard (bash).
# One question per turn -> deploy/answers.json + tfvars -> terraform apply.
#
# Usage:
#   ./deploy/wizard.sh            # collect + apply
#   NO_APPLY=1 ./deploy/wizard.sh # collect only
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANSWERS="${HERE}/answers.json"

cyan()  { printf '\033[36m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
gray()  { printf '\033[90m%s\033[0m\n' "$1"; }

ask() { # ask "Prompt" "default" "choice1 choice2 ..."
  local prompt="$1" def="${2:-}" choices="${3:-}" val=""
  while true; do
    echo ""
    [ -n "$choices" ] && cyan "❯ $prompt [${choices// //}]${def:+ (default: $def)}" || cyan "❯ $prompt${def:+ (default: $def)}"
    read -r -p "  " val || true
    [ -z "$val" ] && [ -n "$def" ] && { echo "$def"; return; }
    [ -z "$val" ] && { gray "  A value is required."; continue; }
    if [ -n "$choices" ] && ! grep -qw "$val" <<<"$choices"; then
      gray "  Choose one of: $choices"; continue
    fi
    echo "$val"; return
  done
}

clear || true
printf '\033[35m%s\033[0m\n' "Query Designer — Deployment Wizard"
gray "One question per turn. Press Enter to accept a default."

declare -A A
A[instanceName]=$(ask "Q1. Name this product instance" "contoso-prod")

gray "  A=shared  B=shared+private  C=isolated(our cloud)  D=customer cloud"
A[isolation]=$(ask "Q2. Choose isolation model" "" "A B C D")
A[designerSurface]=$(ask "Q3. Which designer surface?" "web" "web app vscode")
A[region]=$(ask "Q4. Deployment region" "eastus2")

case "${A[isolation]}" in
  A|B) A[tier]="shared" ;;
  C)
    A[tier]="isolated"; A[cloud]="azure"
    A[tenantId]=$(ask "Q5. Dedicated tenant id (GUID)")
    A[subscriptionId]=$(ask "Q6. Dedicated subscription id (GUID)")
    ;;
  D)
    A[tier]="byo"
    A[cloud]=$(ask "Q5. Target cloud" "azure" "azure aws gcp")
    A[tenantId]=$(ask "Q6. Customer tenant/account id")
    A[subscriptionId]=$(ask "Q7. Customer subscription/project id")
    A[credentialRef]=$(ask "Q8. Credential reference")
    ;;
esac

A[dataSourceType]=$(ask "Q9. Data source type" "sqlserver" "sqlserver databricks snowflake sharepoint excelonline")
if [[ "${A[isolation]}" =~ ^(B|C|D)$ ]]; then
  A[dataConnectivity]=$(ask "Q10. Data connectivity" "internet" "internet ipsec")
else
  A[dataConnectivity]="internet"
fi
A[dataSourceHost]=$(ask "Q11. Data source host / endpoint" "sql.contoso.com")

if [ "${A[isolation]}" = "A" ]; then
  A[endpointExposure]="public"
else
  A[endpointExposure]=$(ask "Q12. Endpoint exposure" "public" "public private")
fi

# Write answers.json
{
  echo "{"
  first=1
  for k in "${!A[@]}"; do
    [ $first -eq 0 ] && echo ","
    printf '  "%s": "%s"' "$k" "${A[$k]}"
    first=0
  done
  echo ""
  echo "}"
} > "$ANSWERS"

green "Answers saved to $ANSWERS"

case "${A[tier]}" in
  shared)   ENVDIR="${HERE}/../infra/environments/shared" ;;
  isolated) ENVDIR="${HERE}/../infra/environments/isolated" ;;
  byo)      ENVDIR="${HERE}/../infra/environments/byo" ;;
esac

cat > "${ENVDIR}/generated.auto.tfvars.json" <<EOF
{
  "instance_name": "${A[instanceName]}",
  "isolation": "${A[isolation]}",
  "designer_surface": "${A[designerSurface]}",
  "region": "${A[region]}",
  "cloud": "${A[cloud]:-azure}",
  "tenant_id": "${A[tenantId]:-}",
  "subscription_id": "${A[subscriptionId]:-}",
  "data_source_type": "${A[dataSourceType]}",
  "data_connectivity": "${A[dataConnectivity]}",
  "data_source_host": "${A[dataSourceHost]}",
  "endpoint_exposure": "${A[endpointExposure]}"
}
EOF
green "Terraform vars written to ${ENVDIR}/generated.auto.tfvars.json"

if [ "${NO_APPLY:-0}" = "1" ]; then
  gray "NO_APPLY set — run: terraform -chdir=\"$ENVDIR\" init && terraform -chdir=\"$ENVDIR\" apply"
  exit 0
fi

if ! command -v terraform >/dev/null 2>&1; then
  gray "terraform not found; install it or set NO_APPLY=1."
  exit 0
fi

terraform -chdir="$ENVDIR" init -input=false
terraform -chdir="$ENVDIR" apply -input=false -auto-approve
green "Deployment complete."
terraform -chdir="$ENVDIR" output
