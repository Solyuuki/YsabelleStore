param(
    [string]$DatabaseName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Stop-Step([string]$Message) {
    throw "VERIFIED-50 BOOTSTRAP STOP: $Message"
}

function Invoke-Step([string]$Label, [scriptblock]$Action) {
    Write-Host ""
    Write-Host "============================================================"
    Write-Host $Label
    Write-Host "============================================================"
    & $Action
    if ($LASTEXITCODE -ne 0) {
        Stop-Step "$Label failed with exit code $LASTEXITCODE."
    }
}

if (-not (Test-Path ".env")) {
    Stop-Step ".env not found in repository root."
}

if (-not $DatabaseName) {
    $databaseUrlLine = Get-Content ".env" |
        Where-Object { $_ -match '^DATABASE_URL=' } |
        Select-Object -First 1

    if (-not $databaseUrlLine) {
        Stop-Step "DATABASE_URL is missing from .env. Pass -DatabaseName explicitly or configure DATABASE_URL."
    }

    $databaseUrl = $databaseUrlLine.Substring("DATABASE_URL=".Length).Trim()
    try {
        $uri = [System.Uri]$databaseUrl
        $DatabaseName = $uri.AbsolutePath.TrimStart("/")
    }
    catch {
        Stop-Step "DATABASE_URL could not be parsed. Pass -DatabaseName explicitly."
    }
}

if ($DatabaseName -notmatch '^[A-Za-z0-9_]+$') {
    Stop-Step "DatabaseName may contain only letters, numbers, and underscore."
}

Write-Host ""
Write-Host "YSABELLESTORE VERIFIED-50 LOCAL BOOTSTRAP"
Write-Host "Target database: $DatabaseName"
Write-Host ""
Write-Host "This workflow is LOCAL/QA only."
Write-Host "It will temporarily sync the canonical catalog, approve the exact reviewed SARIMA 50,"
Write-Host "remove all non-survivor products, then seed verified QA stock."
Write-Host ""

Invoke-Step "[1/9] Sync Prisma schema" {
    npm run prisma:sync:dev
}

Invoke-Step "[2/9] Sync canonical catalog into target database" {
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/db-catalog-sync.ps1 -DatabaseName $DatabaseName -Apply
}

Invoke-Step "[3/9] Ensure zero-stock inventory rows for exact 50 targets" {
    node --env-file=.env --import tsx backend/src/scripts/ensureVerified50Inventory.ts --apply
}

Invoke-Step "[4/9] Prepare exact-50 internal barcode state" {
    node --env-file=.env --import tsx backend/src/scripts/prepareVerified50Barcodes.ts
}

Invoke-Step "[5/9] Normalize storefront category taxonomy" {
    node --env-file=.env --import tsx backend/src/scripts/cleanupStorefrontCategoryTaxonomy.ts --apply-storefront-taxonomy-cleanup
}

Invoke-Step "[6/9] Apply reviewed production-catalog-50 approval" {
    node --env-file=.env --import tsx backend/src/scripts/executeProductionCatalog50.ts --apply-production-catalog-50
}

Invoke-Step "[7/9] Keep only the exact approved SARIMA 50 cohort" {
    node --env-file=.env scripts/qa-keep-non-ysb-50-products.mjs --apply
}

Invoke-Step "[8/9] Seed verified-50 QA inventory batches and stock" {
    node --env-file=.env --import tsx backend/src/scripts/seedVerified50QaStock.ts --apply
}

Invoke-Step "[9/9] Final exact-50 verification" {
    node --env-file=.env scripts/qa-keep-non-ysb-50-products.mjs
}

Write-Host ""
Write-Host "============================================================"
Write-Host "RESULT: VERIFIED_50_BOOTSTRAP_PASS"
Write-Host "============================================================"
Write-Host "Target database: $DatabaseName"
Write-Host "Expected products: 50"
Write-Host "The final guard verified the exact approved SARIMA 50 cohort."
Write-Host ""
