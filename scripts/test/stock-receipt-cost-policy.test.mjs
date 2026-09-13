import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

test("physical stock receipts do not require a verified procurement cost", () => {
  const stockDomain = readRepoFile("backend/src/services/stockDomainService.ts");
  const schema = readRepoFile("database/prisma/schema.prisma");
  const migration = readRepoFile(
    "database/prisma/migrations/20260913030000_allow_unknown_inventory_batch_cost/migration.sql"
  );

  assert.doesNotMatch(stockDomain, /PRODUCT_COST_PRICE_REQUIRED/);
  assert.doesNotMatch(stockDomain, /requireProductCostPrice/);
  assert.match(stockDomain, /function resolveKnownUnitCost\(/);
  assert.match(stockDomain, /return latestKnownBatch\?\.unitCost \?\? null;/);
  assert.match(
    schema,
    /unitCost\s+Decimal\?\s+@map\("unit_cost"\)\s+@db\.Decimal\(10, 2\)/
  );
  assert.match(migration, /MODIFY `unit_cost` DECIMAL\(10, 2\) NULL;/);
});

test("Product Bulk Import keeps its own costPrice onboarding validation", () => {
  const productImport = readRepoFile("backend/src/services/productImportService.ts");

  assert.match(productImport, /const REQUIRED_IMPORT_HEADERS = \[[\s\S]*?"costPrice"/);
  assert.match(
    productImport,
    /const costPrice = parseMoney\(costPriceRaw, "costPrice", row\.rowNumber, errors\);/
  );
  assert.match(productImport, /costPrice !== null/);
});
