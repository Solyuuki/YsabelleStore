import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCTION_CATALOG_50_EXPECTED_COUNT,
  PRODUCTION_CATALOG_50_TARGETS
} from "../src/modules/catalog/catalog-production-ready-50-manifest.js";
import {
  assertProductionCatalog50Manifest,
  buildProductionCatalog50Plan,
  type ProductionCatalog50Client
} from "../src/modules/catalog/catalog-production-ready-50-execution.js";

class FakeDecimal {
  constructor(private readonly value: number) {}

  lessThanOrEqualTo(value: number) {
    return this.value <= value;
  }

  toString() {
    return String(this.value);
  }
}

test("production catalog 50 manifest is exact, unique, complete, and excludes retired P254", () => {
  assert.equal(PRODUCTION_CATALOG_50_TARGETS.length, PRODUCTION_CATALOG_50_EXPECTED_COUNT);
  assert.equal(
    new Set(PRODUCTION_CATALOG_50_TARGETS.map((row) => row.sourceProductId)).size,
    PRODUCTION_CATALOG_50_EXPECTED_COUNT
  );
  assert.equal(
    new Set(PRODUCTION_CATALOG_50_TARGETS.map((row) => row.manufacturerBarcode)).size,
    PRODUCTION_CATALOG_50_EXPECTED_COUNT
  );

  const sourceProductIds: readonly string[] = PRODUCTION_CATALOG_50_TARGETS.map(
    (row) => row.sourceProductId
  );
  assert.equal(sourceProductIds.includes("P254"), false);
  assert.equal(sourceProductIds.includes("P022"), true);
  assert.doesNotThrow(() => assertProductionCatalog50Manifest(PRODUCTION_CATALOG_50_TARGETS));
});

test("manifest validation fails closed for a repository-restricted identity", () => {
  const targets = PRODUCTION_CATALOG_50_TARGETS.map((row, index) =>
    index === 0 ? { ...row, sourceProductId: "P254" } : row
  );

  assert.throws(
    () => assertProductionCatalog50Manifest(targets),
    /PRODUCTION_CATALOG_50_RESTRICTED_IDENTITY/
  );
});

test("preflight preserves price/category/inventory and plans only catalog fields", async () => {
  const products = PRODUCTION_CATALOG_50_TARGETS.map((target) => ({
    id: `id-${target.sourceProductId}`,
    sku: `SARIMA-${target.sourceProductId}`,
    barcode: `YSB-SARIMA-${target.sourceProductId}`,
    name: `Existing ${target.sourceProductId}`,
    description: null,
    costPrice: null,
    sellingPrice: new FakeDecimal(10),
    status: "INACTIVE",
    recordSource: "IMPORT",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false,
    categoryId: "category-canned",
    category: {
      id: "category-canned",
      name: "Canned Goods",
      slug: "canned-goods",
      isActive: true,
      recordSource: "CATALOG",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: true
    },
    inventory: { id: `inventory-${target.sourceProductId}` },
    sourceMapping: null,
    sarimaSourceMapping: { sourceProductId: target.sourceProductId },
    duplicateCandidatesLeft: [],
    duplicateCandidatesRight: []
  }));

  const client: ProductionCatalog50Client = {
    product: {
      findMany: async (args: unknown) => {
        const query = args as { select?: { barcode?: boolean; name?: boolean } };
        if (query.select?.barcode && !query.select?.name) {
          return [];
        }
        return products;
      },
      updateMany: async () => ({ count: 0 })
    },
    category: {
      updateMany: async () => ({ count: 0 })
    },
    catalogAuditLog: {
      create: async () => ({})
    },
    $transaction: async <T>(callback: (tx: ProductionCatalog50Client) => Promise<T>) =>
      callback(client)
  };

  const plan = await buildProductionCatalog50Plan({ client });
  assert.equal(plan.summary.selectedProducts, PRODUCTION_CATALOG_50_EXPECTED_COUNT);
  assert.equal(plan.summary.productWritesRequired, PRODUCTION_CATALOG_50_EXPECTED_COUNT);
  assert.equal(plan.summary.categoryWritesRequired, 0);
  assert.equal(plan.summary.missingProcurementCostWarnings, PRODUCTION_CATALOG_50_EXPECTED_COUNT);
});
