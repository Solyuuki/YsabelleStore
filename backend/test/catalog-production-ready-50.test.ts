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
  assert.equal(PRODUCTION_CATALOG_50_TARGETS.some((row) => row.sourceProductId === "P254"), false);
  assert.equal(PRODUCTION_CATALOG_50_TARGETS.some((row) => row.sourceProductId === "P022"), true);
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

  let findManyCall = 0;
  const client = {
    product: {
      async findMany() {
        findManyCall += 1;
        return findManyCall === 1 ? products : [];
      },
      async updateMany() {
        throw new Error("preview must not write");
      }
    },
    category: {
      async updateMany() {
        throw new Error("preview must not write");
      }
    },
    catalogAuditLog: {
      async create() {
        throw new Error("preview must not write");
      }
    },
    async $transaction<T>(callback: (tx: ProductionCatalog50Client) => Promise<T>) {
      return callback(this as unknown as ProductionCatalog50Client);
    }
  } as unknown as ProductionCatalog50Client;

  const plan = await buildProductionCatalog50Plan({ client });

  assert.deepEqual(plan.summary, {
    selectedProducts: 50,
    productWritesRequired: 50,
    alreadyAlignedProducts: 0,
    categoryWritesRequired: 0,
    missingProcurementCostWarnings: 50
  });
  assert.equal(plan.products.every((row) => row.requiresWrite), true);
  assert.equal(plan.categoriesToApprove.length, 0);
});
