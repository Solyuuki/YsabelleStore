param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseName,
    [string]$RepoRoot = (Get-Location).Path,
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ExpectedSeedSha256 = "641B59285F17C4A01CF930EBB2FF43FA2DD52F8E9FF5CDC2284362C90220D1C6"
$CatalogTables = @(
    "categories",
    "products",
    "product_image_assets",
    "product_aliases",
    "sarima_source_product_mappings"
)
$ProtectedTables = @(
    "users",
    "trusted_devices",
    "customer_accounts",
    "customer_sessions",
    "sales",
    "sale_items",
    "inventory",
    "inventory_batches",
    "inventory_movements",
    "customer_orders",
    "customer_order_items"
)

if ($DatabaseName -notmatch '^[A-Za-z0-9_]+$') {
    throw "STOP: DatabaseName may contain only letters, numbers, and underscore."
}
if ($DatabaseName -in @("information_schema", "mysql", "performance_schema", "sys")) {
    throw "STOP: refusing system database '$DatabaseName'."
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

$Stage = "ysabelle_catalog_stage_" + [guid]::NewGuid().ToString("N").Substring(0, 12)
$BaselineSql = Join-Path $env:TEMP ("ysabelle-canonical-baseline-" + [guid]::NewGuid().ToString("N") + ".sql")
$ApplySql = Join-Path $env:TEMP ("ysabelle-catalog-sync-" + [guid]::NewGuid().ToString("N") + ".sql")
$Secure = Read-Host "MySQL root password" -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
$StageCreated = $false

function Invoke-MySqlScalar([string]$Sql) {
    $value = & $MySql `
        "--host=localhost" `
        "--port=3306" `
        "--user=root" `
        "--batch" `
        "--skip-column-names" `
        "--execute=$Sql"

    if ($LASTEXITCODE -ne 0) { throw "STOP: MySQL query failed." }
    return (($value | Out-String).Trim())
}

function Invoke-MySqlLines([string]$Sql) {
    $value = & $MySql `
        "--host=localhost" `
        "--port=3306" `
        "--user=root" `
        "--batch" `
        "--skip-column-names" `
        "--execute=$Sql"

    if ($LASTEXITCODE -ne 0) { throw "STOP: MySQL query failed." }
    return @($value | ForEach-Object { [string]$_ })
}

function Get-Columns([string]$Db, [string]$Table) {
    return @(Invoke-MySqlLines "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='$Db' AND TABLE_NAME='$Table' ORDER BY COLUMN_NAME;")
}

function Get-ProtectedCounts([string]$Db) {
    $result = @{}
    foreach ($table in $ProtectedTables) {
        $exists = Invoke-MySqlScalar "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='$Db' AND TABLE_NAME='$table';"
        if ($exists -eq "1") {
            $result[$table] = [int64](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$Db``.``$table``;")
        }
    }
    return $result
}

function Get-DiffSummary([string]$SourceDb, [string]$TargetDb) {
    $summary = @{}
    $totalMissing = 0
    $totalChanged = 0
    $totalTargetOnly = 0

    foreach ($table in $CatalogTables) {
        $columns = Get-Columns $SourceDb $table
        if ($columns.Count -eq 0) { throw "STOP: no columns found for '$table'." }
        $diffTerms = @($columns | ForEach-Object { "NOT (s.``$_`` <=> t.``$_``)" })
        $diffExpr = $diffTerms -join " OR "

        $sourceCount = [int](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$SourceDb``.``$table``;")
        $targetCount = [int](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$TargetDb``.``$table``;")
        $missing = [int](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$SourceDb``.``$table`` s LEFT JOIN ``$TargetDb``.``$table`` t ON t.id=s.id WHERE t.id IS NULL;")
        $changed = [int](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$SourceDb``.``$table`` s JOIN ``$TargetDb``.``$table`` t ON t.id=s.id WHERE $diffExpr;")
        $targetOnly = [int](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$TargetDb``.``$table`` t LEFT JOIN ``$SourceDb``.``$table`` s ON s.id=t.id WHERE s.id IS NULL;")

        $summary[$table] = [pscustomobject]@{
            SourceCount = $sourceCount
            TargetCount = $targetCount
            Missing = $missing
            Changed = $changed
            TargetOnly = $targetOnly
        }
        $totalMissing += $missing
        $totalChanged += $changed
        $totalTargetOnly += $targetOnly
    }

    return [pscustomobject]@{
        Tables = $summary
        TotalMissing = $totalMissing
        TotalChanged = $totalChanged
        TotalTargetOnly = $totalTargetOnly
    }
}

function Get-CollisionCount([string]$SourceDb, [string]$TargetDb) {
    $category = [int](Invoke-MySqlScalar @"
SELECT COUNT(*) FROM ``$SourceDb``.categories s
JOIN ``$TargetDb``.categories t
  ON s.id <> t.id AND (s.name=t.name OR s.slug=t.slug);
"@)
    $product = [int](Invoke-MySqlScalar @"
SELECT COUNT(*) FROM ``$SourceDb``.products s
JOIN ``$TargetDb``.products t
  ON s.id <> t.id
 AND (s.sku=t.sku OR (s.barcode IS NOT NULL AND t.barcode=s.barcode));
"@)
    $alias = [int](Invoke-MySqlScalar @"
SELECT COUNT(*) FROM ``$SourceDb``.product_aliases s
JOIN ``$TargetDb``.product_aliases t
  ON s.id <> t.id
 AND s.canonical_product_id=t.canonical_product_id
 AND s.type=t.type
 AND s.normalized_value=t.normalized_value;
"@)
    $sarima = [int](Invoke-MySqlScalar @"
SELECT COUNT(*) FROM ``$SourceDb``.sarima_source_product_mappings s
JOIN ``$TargetDb``.sarima_source_product_mappings t
  ON s.id <> t.id
 AND (s.source_key=t.source_key OR s.source_product_id=t.source_product_id OR s.canonical_product_id=t.canonical_product_id);
"@)

    return [pscustomobject]@{
        Categories = $category
        Products = $product
        Aliases = $alias
        Sarima = $sarima
        Total = ($category + $product + $alias + $sarima)
    }
}

function Sql-ColumnList([string[]]$Columns) {
    return (($Columns | ForEach-Object { "``$_``" }) -join ", ")
}

function Sql-SelectList([string[]]$Columns, [string]$Alias, [string]$NullColumn = "") {
    return (($Columns | ForEach-Object {
        if ($NullColumn -and $_ -eq $NullColumn) { "NULL" } else { "$Alias.``$_``" }
    }) -join ", ")
}

function Sql-UpdateList([string[]]$Columns, [string[]]$SkipColumns = @("id")) {
    $skip = @{}
    foreach ($c in $SkipColumns) { $skip[$c] = $true }
    return (($Columns | Where-Object { -not $skip.ContainsKey($_) } | ForEach-Object { "``$_``=VALUES(``$_``)" }) -join ", ")
}

try {
    $env:MYSQL_PWD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)

    Write-Host ""
    Write-Host "=============================================="
    Write-Host "YSABELLESTORE CATALOG SYNC"
    Write-Host "=============================================="
    Write-Host ("Mode:      " + $(if ($Apply) { "APPLY" } else { "DRY-RUN" }))
    Write-Host "Target DB: $DatabaseName"
    Write-Host "Seed SHA:  $ActualSeedSha256"

    $Version = Invoke-MySqlScalar "SELECT VERSION();"
    Write-Host "MySQL:     $Version"
    if ($Version -notmatch '^8\.') {
        throw "STOP: sync is currently verified only on MySQL 8.x. Detected: $Version"
    }

    $TargetExists = Invoke-MySqlScalar "SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME='$DatabaseName';"
    if ($TargetExists -ne "1") { throw "STOP: target database '$DatabaseName' does not exist." }

    foreach ($table in $CatalogTables) {
        $exists = Invoke-MySqlScalar "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='$DatabaseName' AND TABLE_NAME='$table';"
        if ($exists -ne "1") { throw "STOP: target is missing required table '$table'." }
    }

    Write-Host ""
    Write-Host "[1/5] Building temporary canonical staging database..."
    & $Prisma migrate diff `
        --from-empty `
        --to-schema-datamodel $Schema `
        --script `
        --output $BaselineSql
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $BaselineSql)) {
        throw "STOP: Prisma baseline generation failed."
    }

    & $MySql "--host=localhost" "--port=3306" "--user=root" "--execute=CREATE DATABASE ``$Stage`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if ($LASTEXITCODE -ne 0) { throw "STOP: temporary staging database creation failed." }
    $StageCreated = $true

    $Cmd = "`"$MySql`" --host=localhost --port=3306 --user=root --default-character-set=utf8mb4 `"$Stage`" < `"$BaselineSql`""
    & cmd.exe /d /s /c $Cmd
    if ($LASTEXITCODE -ne 0) { throw "STOP: staging schema load failed." }

    $Cmd = "`"$MySql`" --host=localhost --port=3306 --user=root --default-character-set=utf8mb4 `"$Stage`" < `"$Seed`""
    & cmd.exe /d /s /c $Cmd
    if ($LASTEXITCODE -ne 0) { throw "STOP: staging catalog load failed." }

    Write-Host "[2/5] Checking target schema compatibility..."
    foreach ($table in $CatalogTables) {
        $stageColumns = Get-Columns $Stage $table
        $targetColumns = Get-Columns $DatabaseName $table
        if (($stageColumns -join "|") -ne ($targetColumns -join "|")) {
            throw "STOP: column set mismatch for '$table'."
        }
        $typeMismatch = Invoke-MySqlScalar @"
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS s
JOIN INFORMATION_SCHEMA.COLUMNS t
  ON t.TABLE_SCHEMA='$DatabaseName'
 AND t.TABLE_NAME=s.TABLE_NAME
 AND t.COLUMN_NAME=s.COLUMN_NAME
WHERE s.TABLE_SCHEMA='$Stage'
  AND s.TABLE_NAME='$table'
  AND (s.COLUMN_TYPE <> t.COLUMN_TYPE OR s.IS_NULLABLE <> t.IS_NULLABLE);
"@
        if ($typeMismatch -ne "0") { throw "STOP: type/nullability mismatch for '$table'." }
    }
    Write-Host "  RESULT: TARGET_SCHEMA_COMPATIBLE"

    Write-Host "[3/5] Comparing canonical rows with target..."
    $Before = Get-DiffSummary $Stage $DatabaseName
    foreach ($table in $CatalogTables) {
        $r = $Before.Tables[$table]
        Write-Host ("  {0,-32} canonical={1,-4} target={2,-4} missing={3,-4} changed={4,-4} target-only={5}" -f $table, $r.SourceCount, $r.TargetCount, $r.Missing, $r.Changed, $r.TargetOnly)
    }

    $Collisions = Get-CollisionCount $Stage $DatabaseName
    Write-Host ("  unique-identity collisions: {0}" -f $Collisions.Total)
    if ($Collisions.Total -gt 0) {
        throw "STOP: unique-identity collisions detected. categories=$($Collisions.Categories), products=$($Collisions.Products), aliases=$($Collisions.Aliases), SARIMA=$($Collisions.Sarima)"
    }

    $ProtectedBefore = Get-ProtectedCounts $DatabaseName

    if (-not $Apply) {
        Write-Host ""
        Write-Host "RESULT: DB_CATALOG_SYNC_DRY_RUN_PASS"
        Write-Host "Canonical rows missing: $($Before.TotalMissing)"
        Write-Host "Canonical rows changed: $($Before.TotalChanged)"
        Write-Host "Target-only rows:       $($Before.TotalTargetOnly)"
        Write-Host "No target rows were changed. Re-run with -Apply only on an approved target."
        exit 0
    }

    if (($Before.TotalMissing + $Before.TotalChanged) -eq 0) {
        Write-Host ""
        Write-Host "RESULT: DB_CATALOG_SYNC_NOOP"
        Write-Host "Target already matches every canonical row."
        Write-Host "Target-only rows preserved: $($Before.TotalTargetOnly)"
        exit 0
    }

    Write-Host "[4/5] Applying canonical upserts in one transaction..."

    $catCols = Get-Columns $Stage "categories"
    $prodCols = Get-Columns $Stage "products"
    $assetCols = Get-Columns $Stage "product_image_assets"
    $aliasCols = Get-Columns $Stage "product_aliases"
    $sarimaCols = Get-Columns $Stage "sarima_source_product_mappings"

    $catColumnList = Sql-ColumnList $catCols
    $catSelectList = Sql-SelectList $catCols "s"
    $catUpdateList = Sql-UpdateList $catCols

    $prodColumnList = Sql-ColumnList $prodCols
    $prodSelectList = Sql-SelectList $prodCols "s" "active_image_asset_id"
    $prodUpdateList = Sql-UpdateList $prodCols @("id", "active_image_asset_id")

    $assetColumnList = Sql-ColumnList $assetCols
    $assetSelectList = Sql-SelectList $assetCols "s"
    $assetUpdateList = Sql-UpdateList $assetCols

    $aliasColumnList = Sql-ColumnList $aliasCols
    $aliasSelectList = Sql-SelectList $aliasCols "s"
    $aliasUpdateList = Sql-UpdateList $aliasCols

    $sarimaColumnList = Sql-ColumnList $sarimaCols
    $sarimaSelectList = Sql-SelectList $sarimaCols "s"
    $sarimaUpdateList = Sql-UpdateList $sarimaCols

    $SqlText = @"
SET SESSION sql_safe_updates = 0;
START TRANSACTION;

INSERT INTO ``$DatabaseName``.categories ($catColumnList)
SELECT $catSelectList FROM ``$Stage``.categories s
ON DUPLICATE KEY UPDATE $catUpdateList;

INSERT INTO ``$DatabaseName``.products ($prodColumnList)
SELECT $prodSelectList FROM ``$Stage``.products s
ON DUPLICATE KEY UPDATE $prodUpdateList;

INSERT INTO ``$DatabaseName``.product_image_assets ($assetColumnList)
SELECT $assetSelectList FROM ``$Stage``.product_image_assets s
ON DUPLICATE KEY UPDATE $assetUpdateList;

INSERT INTO ``$DatabaseName``.product_aliases ($aliasColumnList)
SELECT $aliasSelectList FROM ``$Stage``.product_aliases s
ON DUPLICATE KEY UPDATE $aliasUpdateList;

INSERT INTO ``$DatabaseName``.sarima_source_product_mappings ($sarimaColumnList)
SELECT $sarimaSelectList FROM ``$Stage``.sarima_source_product_mappings s
ON DUPLICATE KEY UPDATE $sarimaUpdateList;

UPDATE ``$DatabaseName``.products t
JOIN ``$Stage``.products s ON s.id=t.id
SET t.active_image_asset_id=s.active_image_asset_id;

COMMIT;
"@
    [System.IO.File]::WriteAllText($ApplySql, $SqlText, (New-Object System.Text.UTF8Encoding($false)))

    $Cmd = "`"$MySql`" --host=localhost --port=3306 --user=root --default-character-set=utf8mb4 < `"$ApplySql`""
    & cmd.exe /d /s /c $Cmd
    if ($LASTEXITCODE -ne 0) {
        throw "STOP: catalog sync transaction failed. MySQL rolled back the active transaction unless the server terminated unexpectedly."
    }

    Write-Host "[5/5] Verifying post-sync invariants..."
    $After = Get-DiffSummary $Stage $DatabaseName
    $ProtectedAfter = Get-ProtectedCounts $DatabaseName

    $ProtectedChanged = @()
    foreach ($table in $ProtectedBefore.Keys) {
        if (-not $ProtectedAfter.ContainsKey($table) -or $ProtectedAfter[$table] -ne $ProtectedBefore[$table]) {
            $ProtectedChanged += $table
        }
    }

    $BrokenRefs = [int](Invoke-MySqlScalar @"
SELECT
(
  SELECT COUNT(*) FROM ``$DatabaseName``.products p
  LEFT JOIN ``$DatabaseName``.categories c ON c.id=p.category_id
  WHERE c.id IS NULL
)
+
(
  SELECT COUNT(*) FROM ``$DatabaseName``.product_image_assets a
  LEFT JOIN ``$DatabaseName``.products p ON p.id=a.product_id
  WHERE p.id IS NULL
)
+
(
  SELECT COUNT(*) FROM ``$DatabaseName``.product_aliases a
  LEFT JOIN ``$DatabaseName``.products p ON p.id=a.canonical_product_id
  WHERE p.id IS NULL
)
+
(
  SELECT COUNT(*) FROM ``$DatabaseName``.sarima_source_product_mappings m
  LEFT JOIN ``$DatabaseName``.products p ON p.id=m.canonical_product_id
  WHERE p.id IS NULL
)
+
(
  SELECT COUNT(*) FROM ``$DatabaseName``.products p
  LEFT JOIN ``$DatabaseName``.product_image_assets a ON a.id=p.active_image_asset_id
  WHERE p.active_image_asset_id IS NOT NULL AND a.id IS NULL
) AS broken_references;
"@)

    if ($After.TotalMissing -ne 0 -or $After.TotalChanged -ne 0) {
        throw "STOP: post-sync canonical mismatch remains. missing=$($After.TotalMissing), changed=$($After.TotalChanged)"
    }
    if ($BrokenRefs -ne 0) {
        throw "STOP: post-sync broken catalog references detected: $BrokenRefs"
    }
    if ($ProtectedChanged.Count -gt 0) {
        throw "STOP: protected table row counts changed unexpectedly: $($ProtectedChanged -join ', ')"
    }

    Write-Host ""
    Write-Host "=============================================="
    Write-Host "CATALOG SYNC RESULT"
    Write-Host "=============================================="
    Write-Host "Canonical rows missing: 0"
    Write-Host "Canonical rows changed: 0"
    Write-Host "Target-only rows kept:  $($After.TotalTargetOnly)"
    Write-Host "Broken references:      $BrokenRefs"
    Write-Host "Protected count drift:  0"
    Write-Host "RESULT: DB_CATALOG_SYNC_APPLY_PASS"
}
catch {
    Write-Host ""
    Write-Host $_.Exception.Message
    exit 1
}
finally {
    $env:MYSQL_PWD = $null
    if ($BSTR -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    }
    Remove-Item $BaselineSql -Force -ErrorAction SilentlyContinue
    Remove-Item $ApplySql -Force -ErrorAction SilentlyContinue

    if ($StageCreated) {
        try {
            $cleanupBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
            try {
                $env:MYSQL_PWD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($cleanupBstr)
                & $MySql "--host=localhost" "--port=3306" "--user=root" "--execute=DROP DATABASE IF EXISTS ``$Stage``;" 2>$null | Out-Null
            }
            finally {
                $env:MYSQL_PWD = $null
                if ($cleanupBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($cleanupBstr) }
            }
        }
        catch {
            Write-Host "WARNING: temporary staging DB may remain and can be removed later: $Stage"
        }
    }
}
