import assert from "node:assert/strict";
import test from "node:test";

type ProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  recordSource: string;
};

type SaleItemRow = { saleId: string; productId: string };
type MovementRow = {
  id: string;
  productId: string;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
};

type FakeState = {
  products: ProductRow[];
  saleItems: SaleItemRow[];
  aliases: Array<{ id: string; canonicalProductId: string }>;
  duplicates: Array<{ id: string; leftProductId: string; rightProductId: string }>;
  movements: MovementRow[];
  inventories: number;
  batches: number;
  auditBoth: number;
  auditCanonicalOnly: number;
  auditEntityOnly: number;
  mappingsAsSource: number;
  mappingsAsCanonical: number;
  sarimaMappings: number;
  forecasts: number;
  recommendations: number;
  historicalMonthlySales: number;
  historicalImportRows: number;
  customerOrderItems: number;
  reviews: number;
  images: number;
};

const authorization = {
  developmentSeeds: [{ id: "dev-1", sku: "DEV-001" }],
  legacyRuntimeQa: [{ id: "qa-1", sku: "QA-001", barcode: "4800000000001" }],
  expectedProductDuplicateCandidates: 1,
  expectedProductAliases: 1,
  expectedCatalogAuditLogs: 2,
  expectedInventoryMovements: 2,
  expectedDevelopmentSeedMovements: 1,
  expectedLegacySaleMovements: 1,
  expectedInventoryBatches: 2,
  expectedInventories: 2,
  expectedSaleItems: 1,
  expectedSales: 1
};

function state(overrides: Partial<FakeState> = {}): FakeState {
  return {
    products: [
      { id: "dev-1", sku: "DEV-001", barcode: null, recordSource: "CATALOG" },
      { id: "qa-1", sku: "QA-001", barcode: "4800000000001", recordSource: "CATALOG" }
    ],
    saleItems: [{ saleId: "sale-1", productId: "qa-1" }],
    aliases: [{ id: "alias-1", canonicalProductId: "qa-1" }],
    duplicates: [{ id: "duplicate-1", leftProductId: "qa-1", rightProductId: "dev-1" }],
    movements: [
      {
        id: "movement-dev-1",
        productId: "dev-1",
        type: "INITIAL_STOCK",
        referenceType: "SEED_INITIAL",
        referenceId: "seed-dev-1"
      },
      {
        id: "movement-qa-1",
        productId: "qa-1",
        type: "SALE",
        referenceType: "SALE",
        referenceId: "sale-1"
      }
    ],
    inventories: 2,
    batches: 2,
    auditBoth: 2,
    auditCanonicalOnly: 0,
    auditEntityOnly: 0,
    mappingsAsSource: 0,
    mappingsAsCanonical: 0,
    sarimaMappings: 0,
    forecasts: 0,
    recommendations: 0,
    historicalMonthlySales: 0,
    historicalImportRows: 0,
    customerOrderItems: 0,
    reviews: 0,
    images: 0,
    ...overrides
  };
}

async function loadCleanupModule() {
  const modulePath = "../src/modules/catalog/catalog-known-non-production-cleanup.js";
  const loaded = await import(modulePath).catch(() => null);
  assert.ok(loaded, "known non-production cleanup module must exist");
  assert.equal(typeof loaded.executeKnownNonProductionCatalogCleanup, "function");
  return loaded;
}

function fakeClient(initial: FakeState) {
  const deletes: string[] = [];
  let productFindArgs: any;

  const tx = {
    product: {
      async findMany(args: any) {
        productFindArgs = args;
        return initial.products;
      },
      async deleteMany() {
        deletes.push("products");
        return { count: initial.products.length };
      }
    },
    productAlias: {
      async findMany() { return initial.aliases; },
      async deleteMany() {
        deletes.push("aliases");
        return { count: initial.aliases.length };
      }
    },
    productDuplicateCandidate: {
      async findMany() { return initial.duplicates; },
      async deleteMany() {
        deletes.push("duplicates");
        return { count: initial.duplicates.length };
      }
    },
    inventory: {
      async count() { return initial.inventories; },
      async deleteMany() {
        deletes.push("inventories");
        return { count: initial.inventories };
      }
    },
    inventoryBatch: {
      async count() { return initial.batches; },
      async deleteMany() {
        deletes.push("batches");
        return { count: initial.batches };
      }
    },
    inventoryMovement: {
      async findMany() { return initial.movements; },
      async deleteMany() {
        deletes.push("movements");
        return { count: initial.movements.length };
      }
    },
    saleItem: {
      async findMany(args: any) {
        if (args?.where?.productId?.in) return initial.saleItems;
        const saleIds = new Set(args?.where?.saleId?.in ?? []);
        return initial.saleItems.filter((item) => saleIds.has(item.saleId));
      }
    },
    sale: {
      async count(args: any) {
        const saleIds = new Set(args?.where?.id?.in ?? []);
        return saleIds.size;
      },
      async deleteMany() {
        deletes.push("sales");
        return { count: new Set(initial.saleItems.map((item) => item.saleId)).size };
      }
    },
    catalogAuditLog: {
      async count(args: any) {
        const where = args?.where ?? {};
        const canonical = Boolean(where.canonicalProductId?.in);
        const entity = Boolean(where.entityId?.in);
        const notEntity = Boolean(where.NOT?.entityId?.in);
        const notCanonical = Boolean(where.NOT?.canonicalProductId?.in);
        if (canonical && entity) return initial.auditBoth;
        if (canonical && notEntity) return initial.auditCanonicalOnly;
        if (entity && notCanonical) return initial.auditEntityOnly;
        return 0;
      },
      async deleteMany() {
        deletes.push("auditLogs");
        return { count: initial.auditBoth };
      }
    },
    productCanonicalMapping: {
      async count(args: any) {
        if (args?.where?.sourceProductId) return initial.mappingsAsSource;
        return initial.mappingsAsCanonical;
      }
    },
    sarimaSourceProductMapping: { async count() { return initial.sarimaMappings; } },
    forecastRecord: { async count() { return initial.forecasts; } },
    recommendationRecord: { async count() { return initial.recommendations; } },
    historicalMonthlySales: { async count() { return initial.historicalMonthlySales; } },
    historicalSalesImportRow: { async count() { return initial.historicalImportRows; } },
    customerOrderItem: { async count() { return initial.customerOrderItems; } },
    productReview: { async count() { return initial.reviews; } },
    productImageAsset: { async count() { return initial.images; } }
  };

  const client = {
    async $transaction<T>(callback: (transaction: typeof tx) => Promise<T>): Promise<T> {
      return callback(tx);
    }
  };

  return {
    client,
    deletes,
    getProductFindArgs: () => productFindArgs
  };
}

test("cleanup removes only the exact approved 11-style graph after all guards pass", async () => {
  const cleanup = await loadCleanupModule();
  const { client, deletes, getProductFindArgs } = fakeClient(state());

  const result = await cleanup.executeKnownNonProductionCatalogCleanup({
    client,
    authorization
  });

  assert.deepEqual(getProductFindArgs(), {
    where: { id: { in: ["dev-1", "qa-1"] } },
    select: { id: true, sku: true, barcode: true, recordSource: true },
    orderBy: { id: "asc" }
  });
  assert.deepEqual(deletes, [
    "duplicates",
    "aliases",
    "auditLogs",
    "movements",
    "sales",
    "batches",
    "inventories",
    "products"
  ]);
  assert.deepEqual(result.summary, {
    deletedProductDuplicateCandidates: 1,
    deletedProductAliases: 1,
    deletedCatalogAuditLogs: 2,
    deletedInventoryMovements: 2,
    deletedSales: 1,
    deletedSaleItemsViaCascade: 1,
    deletedInventoryBatches: 2,
    deletedInventories: 2,
    deletedProducts: 2
  });
});

test("cleanup aborts before deletes when an approved identity no longer matches", async () => {
  const cleanup = await loadCleanupModule();
  const bad = state({
    products: [
      { id: "dev-1", sku: "CHANGED", barcode: null, recordSource: "CATALOG" },
      { id: "qa-1", sku: "QA-001", barcode: "4800000000001", recordSource: "CATALOG" }
    ]
  });
  const { client, deletes } = fakeClient(bad);

  await assert.rejects(
    () => cleanup.executeKnownNonProductionCatalogCleanup({ client, authorization }),
    /KNOWN_NON_PRODUCTION_CLEANUP_IDENTITY_MISMATCH/
  );
  assert.deepEqual(deletes, []);
});

test("cleanup aborts before deletes when a touched sale includes an operational product", async () => {
  const cleanup = await loadCleanupModule();
  const mixed = state({
    saleItems: [
      { saleId: "sale-1", productId: "qa-1" },
      { saleId: "sale-1", productId: "real-product" }
    ]
  });
  const { client, deletes } = fakeClient(mixed);

  await assert.rejects(
    () => cleanup.executeKnownNonProductionCatalogCleanup({ client, authorization }),
    /KNOWN_NON_PRODUCTION_CLEANUP_MIXED_SALE/
  );
  assert.deepEqual(deletes, []);
});

test("cleanup aborts before deletes when duplicate evidence crosses the cleanup boundary", async () => {
  const cleanup = await loadCleanupModule();
  const crossed = state({
    duplicates: [
      { id: "duplicate-1", leftProductId: "qa-1", rightProductId: "real-product" }
    ]
  });
  const { client, deletes } = fakeClient(crossed);

  await assert.rejects(
    () => cleanup.executeKnownNonProductionCatalogCleanup({ client, authorization }),
    /KNOWN_NON_PRODUCTION_CLEANUP_CROSS_BOUNDARY_REFERENCE/
  );
  assert.deepEqual(deletes, []);
});

test("cleanup aborts before deletes when a development movement is not seed-owned", async () => {
  const cleanup = await loadCleanupModule();
  const badMovement = state({
    movements: [
      {
        id: "movement-dev-1",
        productId: "dev-1",
        type: "STOCK_IN",
        referenceType: "MANUAL_STOCK_IN",
        referenceId: "manual-1"
      },
      {
        id: "movement-qa-1",
        productId: "qa-1",
        type: "SALE",
        referenceType: "SALE",
        referenceId: "sale-1"
      }
    ]
  });
  const { client, deletes } = fakeClient(badMovement);

  await assert.rejects(
    () => cleanup.executeKnownNonProductionCatalogCleanup({ client, authorization }),
    /KNOWN_NON_PRODUCTION_CLEANUP_UNOWNED_MOVEMENT/
  );
  assert.deepEqual(deletes, []);
});

test("cleanup aborts before deletes when historical or canonical evidence appears", async () => {
  const cleanup = await loadCleanupModule();
  const crossed = state({ historicalMonthlySales: 1 });
  const { client, deletes } = fakeClient(crossed);

  await assert.rejects(
    () => cleanup.executeKnownNonProductionCatalogCleanup({ client, authorization }),
    /KNOWN_NON_PRODUCTION_CLEANUP_CROSS_BOUNDARY_REFERENCE/
  );
  assert.deepEqual(deletes, []);
});
