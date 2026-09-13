import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

test("stock receipts never block on missing cost", () => {
  const stockDomain = readRepoFile("backend/src/services/stockDomainService.ts");
  const schema = readRepoFile("database/prisma/schema.prisma");

  assert.ok(!stockDomain.includes("PRODUCT_COST_PRICE_REQUIRED"));
  assert.ok(!stockDomain.includes("requireProductCostPrice"));
  assert.ok(stockDomain.includes("function resolveKnownUnitCost("));
  assert.ok(stockDomain.includes("latestKnownBatch?.unitCost ?? null"));
  assert.ok(schema.includes("unitCost           Decimal?"));
});

test("product import still validates costPrice", () => {
  const productImport = readRepoFile("backend/src/services/productImportService.ts");

  assert.ok(productImport.includes('"costPrice"'));
  assert.ok(productImport.includes("const costPrice = parseMoney("));
  assert.ok(productImport.includes("costPrice !== null"));
});