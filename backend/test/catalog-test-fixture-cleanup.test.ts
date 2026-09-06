import assert from "node:assert/strict";
import test from "node:test";

import {
  executeTestFixtureCleanup,
  type TestFixtureCleanupAuthorization,
  type TestFixtureCleanupClient,
  type TestFixtureCleanupTransaction
} from "../src/modules/catalog/catalog-test-fixture-cleanup.js";

type QueryWhere = {
  productId?: { in?: string[] };
  saleId?: { in?: string[] };
  id?: { in?: string[] };
  canonicalProductId?: { in?: string[] };
  entityId?: { in?: string[] };
  sourceProductId?: unknown;
  leftProductId?: unknown;
  NOT?: {
    entityId?: { in?: string[] };
    canonicalProductId?: { in?: string[] };
  };
};

function queryWhere(args: unknown): QueryWhere {
  if (!args || typeof args !== "object") return {};
  return (args as { where?: QueryWhere }).where ?? {};
}

type FakeState = {
  fixtureIds: string[];
  saleItems: Array<{ saleId: string; productId: string }>;
  auditBoth: number;
  auditCanonicalOnly: number;
  auditEntityOnly: number;
  inventories: number;
  batches: number;
  movements: number;
  aliases: number;
  mappingsAsSource: number;
  mappingsAsCanonical: number;
  sarimaMappings: number;
  duplicatesLeft: number;
  duplicatesRight: number;
  forecasts: number;
  recommendations: number;
  historicalMonthlySales: number;
  historicalImportRows: number;
  customerOrderItems: number;
  reviews: number;
  images: number;
};

const authorization: TestFixtureCleanupAuthorization = {
  expectedFixtureProducts: 2,
  expectedCatalogAuditLogs: 2,
  expectedInventoryMovements: 2,
  expectedInventoryBatches: 1,
  expectedInventories: 2,
  expectedSaleItems: 1,
  expectedSales: 1
};

function state(overrides: Partial<FakeState> = {}): FakeState {
  return {
    fixtureIds: ["fixture-1", "fixture-2"],
    saleItems: [{ saleId: "sale-test-1", productId: "fixture-1" }],
    auditBoth: 2,
    auditCanonicalOnly: 0,
    auditEntityOnly: 0,
    inventories: 2,
    batches: 1,
    movements: 2,
    aliases: 0,
    mappingsAsSource: 0,
    mappingsAsCanonical: 0,
    sarimaMappings: 0,
    duplicatesLeft: 0,
    duplicatesRight: 0,
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

function fakeClient(initial: FakeState) {
  const deletes: string[] = [];
  let historicalImportRowCountArgs: unknown;
  const tx: TestFixtureCleanupTransaction = {
    product: {
      async findMany() {
        return initial.fixtureIds.map((id) => ({ id }));
      },
      async deleteMany() {
        deletes.push("products");
        return { count: initial.fixtureIds.length };
      }
    },
    inventory: {
      async count() {
        return initial.inventories;
      },
      async deleteMany() {
        deletes.push("inventories");
        return { count: initial.inventories };
      }
    },
    inventoryBatch: {
      async count() {
        return initial.batches;
      },
      async deleteMany() {
        deletes.push("batches");
        return { count: initial.batches };
      }
    },
    inventoryMovement: {
      async count() {
        return initial.movements;
      },
      async deleteMany() {
        deletes.push("movements");
        return { count: initial.movements };
      }
    },
    saleItem: {
      async findMany(args) {
        const where = queryWhere(args);
        if (where.productId?.in) return initial.saleItems;
        const saleIds = new Set(where.saleId?.in ?? []);
        return initial.saleItems.filter((item) => saleIds.has(item.saleId));
      }
    },
    sale: {
      async count(args) {
        const where = queryWhere(args);
        const saleIds = new Set(where.id?.in ?? []);
        return [...saleIds].length;
      },
      async deleteMany() {
        deletes.push("sales");
        return { count: new Set(initial.saleItems.map((item) => item.saleId)).size };
      }
    },
    catalogAuditLog: {
      async count(args) {
        const where = queryWhere(args);
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
    productAlias: {
      async count() {
        return initial.aliases;
      }
    },
    productCanonicalMapping: {
      async count(args) {
        const where = queryWhere(args);
        if (where.sourceProductId) return initial.mappingsAsSource;
        return initial.mappingsAsCanonical;
      }
    },
    sarimaSourceProductMapping: {
      async count() {
        return initial.sarimaMappings;
      }
    },
    productDuplicateCandidate: {
      async count(args) {
        const where = queryWhere(args);
        if (where.leftProductId) return initial.duplicatesLeft;
        return initial.duplicatesRight;
      }
    },
    forecastRecord: {
      async count() {
        return initial.forecasts;
      }
    },
    recommendationRecord: {
      async count() {
        return initial.recommendations;
      }
    },
    historicalMonthlySales: {
      async count() {
        return initial.historicalMonthlySales;
      }
    },
    historicalSalesImportRow: {
      async count(args: unknown) {
        historicalImportRowCountArgs = args;
        return initial.historicalImportRows;
      }
    },
    customerOrderItem: {
      async count() {
        return initial.customerOrderItems;
      }
    },
    productReview: {
      async count() {
        return initial.reviews;
      }
    },
    productImageAsset: {
      async count() {
        return initial.images;
      }
    }
  };

  const client: TestFixtureCleanupClient = {
    async $transaction<T>(callback: (tx: TestFixtureCleanupTransaction) => Promise<T>): Promise<T> {
      return callback(tx);
    }
  };

  return {
    client,
    deletes,
    getHistoricalImportRowCountArgs: () => historicalImportRowCountArgs
  };
}

test("cleanup deletes only the exact approved TEST_FIXTURE graph after all guards pass", async () => {
  const { client, deletes } = fakeClient(state());

  const result = await executeTestFixtureCleanup({ client, authorization });

  assert.deepEqual(deletes, [
    "auditLogs",
    "sales",
    "movements",
    "batches",
    "inventories",
    "products"
  ]);
  assert.deepEqual(result.summary, {
    deletedCatalogAuditLogs: 2,
    deletedSales: 1,
    deletedSaleItemsViaCascade: 1,
    deletedInventoryMovements: 2,
    deletedInventoryBatches: 1,
    deletedInventories: 2,
    deletedProducts: 2
  });
});

test("cleanup checks historical import rows through matchedProductId", async () => {
  const { client, getHistoricalImportRowCountArgs } = fakeClient(state());

  await executeTestFixtureCleanup({ client, authorization });

  assert.deepEqual(getHistoricalImportRowCountArgs(), {
    where: { matchedProductId: { in: ["fixture-1", "fixture-2"] } }
  });
});

test("cleanup aborts before any delete when a touched sale contains a non-fixture Product", async () => {
  const mixed = state({
    saleItems: [
      { saleId: "sale-test-1", productId: "fixture-1" },
      { saleId: "sale-test-1", productId: "real-product" }
    ]
  });
  const { client, deletes } = fakeClient(mixed);

  await assert.rejects(
    () => executeTestFixtureCleanup({ client, authorization }),
    /TEST_FIXTURE_CLEANUP_MIXED_SALE/
  );
  assert.deepEqual(deletes, []);
});

test("cleanup aborts before any delete when a fixture participates in a canonical or SARIMA boundary", async () => {
  const { client, deletes } = fakeClient(state({ sarimaMappings: 1 }));

  await assert.rejects(
    () => executeTestFixtureCleanup({ client, authorization }),
    /TEST_FIXTURE_CLEANUP_CROSS_BOUNDARY_REFERENCE/
  );
  assert.deepEqual(deletes, []);
});

test("cleanup aborts before any delete when approved counts drift", async () => {
  const { client, deletes } = fakeClient(state({ movements: 3 }));

  await assert.rejects(
    () => executeTestFixtureCleanup({ client, authorization }),
    /TEST_FIXTURE_CLEANUP_AUTHORIZATION_MISMATCH/
  );
  assert.deepEqual(deletes, []);
});
