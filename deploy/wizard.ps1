#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Query Designer SaaS deployment wizard.
.DESCRIPTION
    Asks one question per turn, collects answers, writes deploy/answers.json and the matching
    Terraform tfvars, then (optionally) drives `terraform apply` for the chosen isolation option.

    Branching:
      A / B -> infra/environments/shared
      C     -> infra/environments/isolated
      D     -> infra/environments/byo
.EXAMPLE
    ./deploy/wizard.ps1
.EXAMPLE
    ./deploy/wizard.ps1 -NoApply        # collect answers only, skip terraform
#>
[CmdletBinding()]
param(
    [switch]$NoApply,
    [string]$AnswersPath = "$PSScriptRoot/answers.json"
)

$ErrorActionPreference = 'Stop'

# ----------------------------------------------------------------------------- helpers
function Ask {
    param(
        [Parameter(Mandatory)][string]$Prompt,
        [string[]]$Choices,
        [string]$Default,
        [switch]$Secret
    )
    while ($true) {
        $hint = if ($Choices) { " [$($Choices -join '/')]" } else { '' }
        $def  = if ($Default) { " (default: $Default)" } else { '' }
        Write-Host ''
        Write-Host "❯ $Prompt$hint$def" -ForegroundColor Cyan
        if ($Secret) {
            $secure = Read-Host -AsSecureString '  '
            $val = [System.Net.NetworkCredential]::new('', $secure).Password
        } else {
            $val = Read-Host '  '
        }
        if ([string]::IsNullOrWhiteSpace($val) -and $Default) { return $Default }
        if ([string]::IsNullOrWhiteSpace($val)) { Write-Host '  A value is required.' -ForegroundColor Yellow; continue }
        if ($Choices -and ($Choices -notcontains $val)) {
            Write-Host "  Please choose one of: $($Choices -join ', ')" -ForegroundColor Yellow; continue
        }
        return $val
    }
}

function Write-Section($text) {
    Write-Host ''
    Write-Host "── $text " -ForegroundColor Green -NoNewline
    Write-Host ('─' * [Math]::Max(0, 60 - $text.Length)) -ForegroundColor DarkGray
}

# ----------------------------------------------------------------------------- intro
Clear-Host
Write-Host 'Query Designer — Deployment Wizard' -ForegroundColor Magenta
Write-Host 'One question per turn. Press Enter to accept a default in (parentheses).' -ForegroundColor DarkGray

$answers = [ordered]@{}

# Q1 — instance name (always)
Write-Section 'Identity'
$answers.instanceName = Ask -Prompt 'Q1. Name this product instance' -Default 'contoso-prod'

# Q2 — isolation model (always) -> drives the branch
Write-Section 'Isolation model'
Write-Host '  A = shared compute + shared data, public endpoint'
Write-Host '  B = shared compute + shared data, public OR private (VPN/IPSec) endpoint'
Write-Host '  C = isolated compute + isolated data in OUR cloud'
Write-Host '  D = deployed into the CUSTOMER''s own tenant/cloud (Azure/AWS/GCP)'
$answers.isolation = (Ask -Prompt 'Q2. Choose isolation model' -Choices @('A','B','C','D')).ToUpper()

# Q3 — designer surface (always)
Write-Section 'Designer experience'
$answers.designerSurface = Ask -Prompt 'Q3. Which designer surface?' -Choices @('web','app','vscode') -Default 'web'

# Q8 — region (always)
Write-Section 'Region'
$answers.region = Ask -Prompt 'Q4. Deployment region' -Default 'eastus2'

# Branch-specific questions
switch ($answers.isolation) {
    { $_ -in 'A','B' } {
        Write-Section 'Shared hosting & data'
        $answers.tier = 'shared'
    }
    'C' {
        Write-Section 'Dedicated subscription (our cloud)'
        $answers.tier           = 'isolated'
        $answers.cloud          = 'azure'
        $answers.tenantId       = Ask -Prompt 'Q5. Dedicated Entra tenant id (GUID)'
        $answers.subscriptionId = Ask -Prompt 'Q6. Dedicated subscription id (GUID)'
    }
    'D' {
        Write-Section 'Customer-owned cloud (BYO)'
        $answers.tier           = 'byo'
        $answers.cloud          = Ask -Prompt 'Q5. Target cloud' -Choices @('azure','aws','gcp') -Default 'azure'
        $answers.tenantId       = Ask -Prompt 'Q6. Customer tenant/account id'
        $answers.subscriptionId = Ask -Prompt 'Q7. Customer subscription/project id'
        $answers.credentialRef  = Ask -Prompt 'Q8. Credential reference (e.g. kv://customer-sp, env:AWS_PROFILE)'
    }
}

# Data source (always)
Write-Section 'Data source'
$answers.dataSourceType = Ask -Prompt 'Q9. Data source type' `
    -Choices @('sqlserver','databricks','snowflake','sharepoint','excelonline') -Default 'sqlserver'

if ($answers.isolation -in 'B','C','D') {
    $answers.dataConnectivity = Ask -Prompt 'Q10. Data connectivity to the source' -Choices @('internet','ipsec') -Default 'internet'
} else {
    $answers.dataConnectivity = 'internet'
}
$answers.dataSourceHost = Ask -Prompt 'Q11. Data source host / endpoint' -Default 'sql.contoso.com'

# Endpoint exposure (always)
Write-Section 'Published endpoint'
if ($answers.isolation -eq 'A') {
    $answers.endpointExposure = 'public'
    Write-Host '  Option A publishes over the public internet only.' -ForegroundColor DarkGray
} else {
    $answers.endpointExposure = Ask -Prompt 'Q12. Endpoint exposure' -Choices @('public','private') -Default 'public'
}

# ----------------------------------------------------------------------------- persist
$answers.createdUtc = (Get-Date).ToUniversalTime().ToString('o')
$answers | ConvertTo-Json -Depth 6 | Set-Content -Path $AnswersPath -Encoding utf8

Write-Section 'Summary'
$answers.GetEnumerator() | ForEach-Object { '{0,-18} = {1}' -f $_.Key, $_.Value } | Write-Host
Write-Host ''
Write-Host "Answers saved to $AnswersPath" -ForegroundColor Green

# Map tier -> terraform environment
$envDir = switch ($answers.tier) {
    'shared'   { "$PSScriptRoot/../infra/environments/shared" }
    'isolated' { "$PSScriptRoot/../infra/environments/isolated" }
    'byo'      { "$PSScriptRoot/../infra/environments/byo" }
}

# Emit tfvars (Terraform reads JSON tfvars natively)
$tfvarsPath = Join-Path $envDir 'generated.auto.tfvars.json'
$tfvars = [ordered]@{
    instance_name     = $answers.instanceName
    isolation         = $answers.isolation
    designer_surface  = $answers.designerSurface
    region            = $answers.region
    cloud             = ($answers.cloud   ?? 'azure')
    tenant_id         = ($answers.tenantId ?? '')
    subscription_id   = ($answers.subscriptionId ?? '')
    data_source_type  = $answers.dataSourceType
    data_connectivity = $answers.dataConnectivity
    data_source_host  = $answers.dataSourceHost
    endpoint_exposure = $answers.endpointExposure
}
$tfvars | ConvertTo-Json -Depth 6 | Set-Content -Path $tfvarsPath -Encoding utf8
Write-Host "Terraform vars written to $tfvarsPath" -ForegroundColor Green

if ($NoApply) {
    Write-Host ''
    Write-Host 'NoApply set — skipping terraform. Review the files above, then run:' -ForegroundColor Yellow
    Write-Host "  terraform -chdir=`"$envDir`" init && terraform -chdir=`"$envDir`" apply" -ForegroundColor Yellow
    return
}

# ----------------------------------------------------------------------------- apply
Write-Section 'Provisioning'
if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    Write-Host 'terraform not found on PATH. Install Terraform >= 1.6 and re-run, or use -NoApply.' -ForegroundColor Red
    return
}

Push-Location $envDir
try {
    terraform init -input=false
    terraform apply -input=false -auto-approve
    Write-Host ''
    Write-Host 'Deployment complete. Designer + endpoint outputs:' -ForegroundColor Green
    terraform output
} finally {
    Pop-Location
}
