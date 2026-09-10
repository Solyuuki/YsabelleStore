param(
    [string]$RepoRoot = (Get-Location).Path,
    [string]$DatabaseName = "ysabellestore_catalog_v1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ExpectedSeedSha256 = "641B59285F17C4A01CF930EBB2FF43FA2DD52F8E9FF5CDC2284362C90220D1C6"
$ExpectedCounts = [ordered]@{
    categories = 20
    products = 466
    product_image_assets = 426
    product_aliases = 20
    sarima_source_product_mappings = 466
    users = 0
    customer_accounts = 0
    customer_sessions = 0
    sales = 0
    inventory = 0
}

if ($DatabaseName -notmatch '^[A-Za-z0-9_]+$') {
    throw "STOP: DatabaseName may contain only letters, numbers, and underscore."
}

$Schema = Join-Path $RepoRoot "database\prisma\schema.prisma"
$Seed = Join-Path $RepoRoot "database\seed\canonical-catalog-v1.sql"
$Prisma = Join-Path $RepoRoot "node_modules\.bin\prisma.cmd"

$MySqlCandidates = @(
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
    (Get-Command mysql.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

if (-not (Test-Path $Schema)) { throw "STOP: Prisma schema not found: $Schema" }
if (-not (Test-Path $Seed)) { throw "STOP: canonical catalog snapshot not found: $Seed" }
if (-not (Test-Path $Prisma)) { throw "STOP: local Prisma CLI not found. Run npm install first." }
if (-not $MySqlCandidates -or $MySqlCandidates.Count -eq 0) { throw "STOP: mysql.exe not found." }

$MySql = $MySqlCandidates[0]
$ActualSeedSha256 = (Get-FileHash $Seed -Algorithm SHA256).Hash
if ($ActualSeedSha256 -ne $ExpectedSeedSha256) {
    throw "STOP: canonical catalog snapshot hash mismatch. Expected $ExpectedSeedSha256 but found $ActualSeedSha256"
}

$BaselineSql = Join-Path $env:TEMP ("ysabelle-canonical-baseline-" + [guid]::NewGuid().ToString("N") + ".sql")
$Secure = Read-Host "MySQL root password" -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
$CreatedDatabase = $false

function Invoke-MySqlScalar([string]$Sql) {
    $value = & $MySql `
        "--host=localhost" `
        "--port=3306" `
        "--user=root" `
        "--batch" `
        "--skip-column-names" `
        "--execute=$Sql"

    if ($LASTEXITCODE -ne 0) {
        throw "STOP: MySQL query failed."
    }

    return (($value | Out-String).Trim())
}

try {
    $env:MYSQL_PWD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)

    Write-Host ""
    Write-Host "=============================================="
    Write-Host "YSABELLESTORE CANONICAL CATALOG BOOTSTRAP"
    Write-Host "=============================================="
    Write-Host "Repo:      $RepoRoot"
    Write-Host "Database:  $DatabaseName"
    Write-Host "Seed SHA:  $ActualSeedSha256"

    $Version = Invoke-MySqlScalar "SELECT VERSION();"
    Write-Host "MySQL:     $Version"
    if ($Version -notmatch '^8\.') {
        throw "STOP: this bootstrap is currently verified only on MySQL 8.x. Detected: $Version"
    }

    $Exists = Invoke-MySqlScalar "SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '$DatabaseName';"
    if ($Exists -ne "0") {
        throw "STOP: database '$DatabaseName' already exists. Nothing was changed. Use a new DatabaseName or keep the existing DB untouched."
    }

    Write-Host ""
    Write-Host "[1/4] Generating schema baseline from repository Prisma schema..."
    & $Prisma migrate diff `
        --from-empty `
        --to-schema-datamodel $Schema `
        --script `
        --output $BaselineSql
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $BaselineSql)) {
        throw "STOP: Prisma baseline generation failed."
    }

    Write-Host "[2/4] Creating fresh local database..."
    & $MySql `
        "--host=localhost" `
        "--port=3306" `
        "--user=root" `
        "--execute=CREATE DATABASE ``$DatabaseName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if ($LASTEXITCODE -ne 0) { throw "STOP: database creation failed." }
    $CreatedDatabase = $true

    $Cmd = "`"$MySql`" --host=localhost --port=3306 --user=root --default-character-set=utf8mb4 `"$DatabaseName`" < `"$BaselineSql`""
    & cmd.exe /d /s /c $Cmd
    if ($LASTEXITCODE -ne 0) { throw "STOP: schema baseline application failed." }

    Write-Host "[3/4] Importing sanitized canonical catalog snapshot..."
    $Cmd = "`"$MySql`" --host=localhost --port=3306 --user=root --default-character-set=utf8mb4 `"$DatabaseName`" < `"$Seed`""
    & cmd.exe /d /s /c $Cmd
    if ($LASTEXITCODE -ne 0) { throw "STOP: catalog import failed." }

    Write-Host "[4/4] Verifying exact counts and catalog references..."
    foreach ($entry in $ExpectedCounts.GetEnumerator()) {
        $actual = Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$DatabaseName``.``$($entry.Key)``;"
        if ($actual -ne [string]$entry.Value) {
            throw "STOP: count mismatch for $($entry.Key). Expected $($entry.Value), found $actual"
        }
        Write-Host ("  {0,-32} {1}" -f $entry.Key, $actual)
    }

    $InvariantSql = @"
SELECT
(
    SELECT COUNT(*)
    FROM ``$DatabaseName``.products p
    LEFT JOIN ``$DatabaseName``.categories c ON c.id = p.category_id
    WHERE c.id IS NULL
)
+
(
    SELECT COUNT(*)
    FROM ``$DatabaseName``.product_image_assets a
    LEFT JOIN ``$DatabaseName``.products p ON p.id = a.product_id
    WHERE p.id IS NULL
)
+
(
    SELECT COUNT(*)
    FROM ``$DatabaseName``.product_aliases a
    LEFT JOIN ``$DatabaseName``.products p ON p.id = a.canonical_product_id
    WHERE p.id IS NULL
)
+
(
    SELECT COUNT(*)
    FROM ``$DatabaseName``.sarima_source_product_mappings m
    LEFT JOIN ``$DatabaseName``.products p ON p.id = m.canonical_product_id
    WHERE p.id IS NULL
)
+
(
    SELECT COUNT(*)
    FROM ``$DatabaseName``.products p
    LEFT JOIN ``$DatabaseName``.product_image_assets a ON a.id = p.active_image_asset_id
    WHERE p.active_image_asset_id IS NOT NULL
      AND a.id IS NULL
) AS broken_references;
"@

    $Broken = Invoke-MySqlScalar $InvariantSql
    if ($Broken -ne "0") {
        throw "STOP: broken catalog references detected: $Broken"
    }

    Write-Host ""
    Write-Host "RESULT: DB_CATALOG_BOOTSTRAP_PASS"
    Write-Host "Database:          $DatabaseName"
    Write-Host "Products:          466"
    Write-Host "Broken references: 0"
    Write-Host "Sensitive rows:    0"
    Write-Host ""
    Write-Host "Existing databases were not modified."
}
catch {
    Write-Host ""
    Write-Host $_.Exception.Message
    if ($CreatedDatabase) {
        Write-Host "Newly-created database left in place for inspection: $DatabaseName"
        Write-Host "No pre-existing database was modified."
    }
    exit 1
}
finally {
    $env:MYSQL_PWD = $null
    if ($BSTR -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    }
    Remove-Item $BaselineSql -Force -ErrorAction SilentlyContinue
}
