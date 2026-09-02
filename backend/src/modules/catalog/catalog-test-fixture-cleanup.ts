type CountResult = { count: number };
type ProductIdRow = { id: string };
type SaleItemRow = { saleId: string; productId: string };

type CountModel = {
  count(args: unknown): Promise<number>;
};

type DeleteManyModel = {
  deleteMany(args: unknown): Promise<CountResult>;
};

export type TestFixtureCleanupTransaction = {
  product: {
    findMany(args: unknown): Promise<ProductIdRow[]>;
    deleteMany(args: unknown): Promise<CountResult>;
  };
  inventory: CountModel & DeleteManyModel;
  inventoryBatch: CountModel & DeleteManyModel;
  inventoryMovement: CountModel & DeleteManyModel;
  saleItem: {
    findMany(args: unknown): Promise<SaleItemRow[]>;
  };
  sale: CountModel & DeleteManyModel;
  catalogAuditLog: CountModel & DeleteManyModel;
  productAlias: CountModel;
  productCanonicalMapping: CountModel;
  sarimaSourceProductMapping: CountModel;
  productDuplicateCandidate: CountModel;
  forecastRecord: CountModel;
  recommendationRecord: CountModel;
  historicalMonthlySales: CountModel;
  historicalSalesImportRow: CountModel;
  customerOrderItem: CountModel;
  productReview: CountModel;
  productImageAsset: CountModel;
};

export type TestFixtureCleanupClient = {
  $transaction<T>(
    callback: (tx: TestFixtureCleanupTransaction) => Promise<T>
  ): Promise<T>;
};

export type TestFixtureCleanupAuthorization = {
  expectedFixtureProducts: number;
  expectedCatalogAuditLogs: number;
  expectedInventoryMovements: number;
  expectedInventoryBatches: number;
  expectedInventories: number;
  expectedSaleItems: number;
  expectedSales: number;
};

export type TestFixtureCleanupResult = {
  summary: {
    deletedCatalogAuditLogs: number;
    deletedSales: number;
    deletedSaleItemsViaCascade: number;
    deletedInventoryMovements: number;
    deletedInventoryBatches: number;
    deletedInventories: number;
    deletedProducts: number;
  };
};

function fail(code: string, detail?: string): never {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function assertExact(label: string, actual: number, expected: number) {
  if (actual !== expected) {
    fail(
      "TEST_FIXTURE_CLEANUP_AUTHORIZATION_MISMATCH",
      `${label} expected ${expected}, found ${actual}`
    );
  }
}

function assertZero(label: string, actual: number) {
  if (actual !== 0) {
    fail(
      "TEST_FIXTURE_CLEANUP_CROSS_BOUNDARY_REFERENCE",
      `${label} must be 0, found ${actual}`
    );
  }
}

export async function executeTestFixtureCleanup(input: {
  client: TestFixtureCleanupClient;
  authorization: TestFixtureCleanupAuthorization;
}): Promise<TestFixtureCleanupResult> {
  return input.client.$transaction(async (tx) => {
    const fixtureRows = await tx.product.findMany({
      where: { recordSource: "TEST_FIXTURE" },
      select: { id: true },
      orderBy: { id: "asc" }
    });
    const fixtureIds = fixtureRows.map((row) => row.id);
    const fixtureIdSet = new Set(fixtureIds);

    assertExact(
      "fixture products",
      fixtureIds.length,
      input.authorization.expectedFixtureProducts
    );

    const fixtureSaleItems = await tx.saleItem.findMany({
      where: { productId: { in: fixtureIds } },
      select: { saleId: true, productId: true }
    });
    const touchedSaleIds = [
      ...new Set(fixtureSaleItems.map((item) => item.saleId))
    ];
    const allTouchedSaleItems =
      touchedSaleIds.length === 0
        ? []
        : await tx.saleItem.findMany({
            where: { saleId: { in: touchedSaleIds } },
            select: { saleId: true, productId: true }
          });

    const mixedSaleItem = allTouchedSaleItems.find(
      (item) => !fixtureIdSet.has(item.productId)
    );
    if (mixedSaleItem) {
      fail(
        "TEST_FIXTURE_CLEANUP_MIXED_SALE",
        `sale ${mixedSaleItem.saleId} contains non-fixture product ${mixedSaleItem.productId}`
      );
    }

    const [
      saleCount,
      inventoryCount,
      batchCount,
      movementCount,
      auditBoth,
      auditCanonicalOnly,
      auditEntityOnly,
      aliases,
      mappingsAsSource,
      mappingsAsCanonical,
      sarimaMappings,
      duplicatesLeft,
      duplicatesRight,
      forecasts,
      recommendations,
      historicalMonthlySales,
      historicalImportRows,
      customerOrderItems,
      reviews,
      images
    ] = await Promise.all([
      tx.sale.count({ where: { id: { in: touchedSaleIds } } }),
      tx.inventory.count({ where: { productId: { in: fixtureIds } } }),
      tx.inventoryBatch.count({ where: { productId: { in: fixtureIds } } }),
      tx.inventoryMovement.count({ where: { productId: { in: fixtureIds } } }),
      tx.catalogAuditLog.count({
        where: {
          canonicalProductId: { in: fixtureIds },
          entityId: { in: fixtureIds }
        }
      }),
      tx.catalogAuditLog.count({
        where: {
          canonicalProductId: { in: fixtureIds },
          NOT: { entityId: { in: fixtureIds } }
        }
      }),
      tx.catalogAuditLog.count({
        where: {
          entityId: { in: fixtureIds },
          NOT: { canonicalProductId: { in: fixtureIds } }
        }
      }),
      tx.productAlias.count({ where: { canonicalProductId: { in: fixtureIds } } }),
      tx.productCanonicalMapping.count({ where: { sourceProductId: { in: fixtureIds } } }),
      tx.productCanonicalMapping.count({ where: { canonicalProductId: { in: fixtureIds } } }),
      tx.sarimaSourceProductMapping.count({ where: { canonicalProductId: { in: fixtureIds } } }),
      tx.productDuplicateCandidate.count({ where: { leftProductId: { in: fixtureIds } } }),
      tx.productDuplicateCandidate.count({ where: { rightProductId: { in: fixtureIds } } }),
      tx.forecastRecord.count({ where: { productId: { in: fixtureIds } } }),
      tx.recommendationRecord.count({ where: { productId: { in: fixtureIds } } }),
      tx.historicalMonthlySales.count({ where: { productId: { in: fixtureIds } } }),
      tx.historicalSalesImportRow.count({ where: { matchedProductId: { in: fixtureIds } } }),
      tx.customerOrderItem.count({ where: { productId: { in: fixtureIds } } }),
      tx.productReview.count({ where: { productId: { in: fixtureIds } } }),
      tx.productImageAsset.count({ where: { productId: { in: fixtureIds } } })
    ]);

    assertExact(
      "fixture sale items",
      fixtureSaleItems.length,
      input.authorization.expectedSaleItems
    );
    assertExact(
      "test-only sales",
      touchedSaleIds.length,
      input.authorization.expectedSales
    );
    assertExact("persisted touched sales", saleCount, input.authorization.expectedSales);
    assertExact("inventories", inventoryCount, input.authorization.expectedInventories);
    assertExact("inventory batches", batchCount, input.authorization.expectedInventoryBatches);
    assertExact(
      "inventory movements",
      movementCount,
      input.authorization.expectedInventoryMovements
    );
    assertExact(
      "fixture-owned catalog audit logs",
      auditBoth,
      input.authorization.expectedCatalogAuditLogs
    );

    assertZero("cross-boundary canonical audit logs", auditCanonicalOnly);
    assertZero("cross-boundary entity audit logs", auditEntityOnly);
    assertZero("product aliases", aliases);
    assertZero("canonical mappings as source", mappingsAsSource);
    assertZero("canonical mappings as canonical", mappingsAsCanonical);
    assertZero("SARIMA mappings", sarimaMappings);
    assertZero("duplicate candidates as left product", duplicatesLeft);
    assertZero("duplicate candidates as right product", duplicatesRight);
    assertZero("forecast records", forecasts);
    assertZero("recommendation records", recommendations);
    assertZero("historical monthly sales", historicalMonthlySales);
    assertZero("historical sales import rows", historicalImportRows);
    assertZero("customer order items", customerOrderItems);
    assertZero("product reviews", reviews);
    assertZero("product image assets", images);

    const deletedAuditLogs = await tx.catalogAuditLog.deleteMany({
      where: {
        canonicalProductId: { in: fixtureIds },
        entityId: { in: fixtureIds }
      }
    });
    const deletedSales = await tx.sale.deleteMany({
      where: { id: { in: touchedSaleIds } }
    });
    const deletedMovements = await tx.inventoryMovement.deleteMany({
      where: { productId: { in: fixtureIds } }
    });
    const deletedBatches = await tx.inventoryBatch.deleteMany({
      where: { productId: { in: fixtureIds } }
    });
    const deletedInventories = await tx.inventory.deleteMany({
      where: { productId: { in: fixtureIds } }
    });
    const deletedProducts = await tx.product.deleteMany({
      where: {
        id: { in: fixtureIds },
        recordSource: "TEST_FIXTURE"
      }
    });

    assertExact(
      "deleted catalog audit logs",
      deletedAuditLogs.count,
      input.authorization.expectedCatalogAuditLogs
    );
    assertExact("deleted sales", deletedSales.count, input.authorization.expectedSales);
    assertExact(
      "deleted inventory movements",
      deletedMovements.count,
      input.authorization.expectedInventoryMovements
    );
    assertExact(
      "deleted inventory batches",
      deletedBatches.count,
      input.authorization.expectedInventoryBatches
    );
    assertExact(
      "deleted inventories",
      deletedInventories.count,
      input.authorization.expectedInventories
    );
    assertExact(
      "deleted products",
      deletedProducts.count,
      input.authorization.expectedFixtureProducts
    );

    return {
      summary: {
        deletedCatalogAuditLogs: deletedAuditLogs.count,
        deletedSales: deletedSales.count,
        deletedSaleItemsViaCascade: fixtureSaleItems.length,
        deletedInventoryMovements: deletedMovements.count,
        deletedInventoryBatches: deletedBatches.count,
        deletedInventories: deletedInventories.count,
        deletedProducts: deletedProducts.count
      }
    };
  });
}
