type CountResult = { count: number };
type ProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  recordSource: string;
};
type SaleItemRow = { saleId: string; productId: string };
type AliasRow = { id: string; canonicalProductId: string };
type DuplicateRow = { id: string; leftProductId: string; rightProductId: string };
type MovementRow = {
  id: string;
  productId: string;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
};

type CountModel = {
  count(args: unknown): Promise<number>;
};

type DeleteManyModel = {
  deleteMany(args: unknown): Promise<CountResult>;
};

export type KnownNonProductionCleanupTransaction = {
  product: {
    findMany(args: unknown): Promise<ProductRow[]>;
    deleteMany(args: unknown): Promise<CountResult>;
  };
  productAlias: {
    findMany(args: unknown): Promise<AliasRow[]>;
    deleteMany(args: unknown): Promise<CountResult>;
  };
  productDuplicateCandidate: {
    findMany(args: unknown): Promise<DuplicateRow[]>;
    deleteMany(args: unknown): Promise<CountResult>;
  };
  inventory: CountModel & DeleteManyModel;
  inventoryBatch: CountModel & DeleteManyModel;
  inventoryMovement: {
    findMany(args: unknown): Promise<MovementRow[]>;
    deleteMany(args: unknown): Promise<CountResult>;
  };
  saleItem: {
    findMany(args: unknown): Promise<SaleItemRow[]>;
  };
  sale: CountModel & DeleteManyModel;
  catalogAuditLog: CountModel & DeleteManyModel;
  productCanonicalMapping: CountModel;
  sarimaSourceProductMapping: CountModel;
  forecastRecord: CountModel;
  recommendationRecord: CountModel;
  historicalMonthlySales: CountModel;
  historicalSalesImportRow: CountModel;
  customerOrderItem: CountModel;
  productReview: CountModel;
  productImageAsset: CountModel;
};

export type KnownNonProductionCleanupClient = {
  $transaction<T>(
    callback: (tx: KnownNonProductionCleanupTransaction) => Promise<T>
  ): Promise<T>;
};

export type KnownNonProductionCleanupAuthorization = {
  developmentSeeds: readonly { id: string; sku: string }[];
  legacyRuntimeQa: readonly { id: string; sku: string; barcode: string }[];
  expectedProductDuplicateCandidates: number;
  expectedProductAliases: number;
  expectedCatalogAuditLogs: number;
  expectedInventoryMovements: number;
  expectedDevelopmentSeedMovements: number;
  expectedLegacySaleMovements: number;
  expectedInventoryBatches: number;
  expectedInventories: number;
  expectedSaleItems: number;
  expectedSales: number;
};

export type KnownNonProductionCleanupResult = {
  summary: {
    deletedProductDuplicateCandidates: number;
    deletedProductAliases: number;
    deletedCatalogAuditLogs: number;
    deletedInventoryMovements: number;
    deletedSales: number;
    deletedSaleItemsViaCascade: number;
    deletedInventoryBatches: number;
    deletedInventories: number;
    deletedProducts: number;
  };
};

const ALLOWED_DEVELOPMENT_MOVEMENT_REFERENCE_TYPES = new Set([
  "SEED_INITIAL",
  "SEED_ADJUSTMENT",
  "STOCK_RECONCILIATION",
  "SEED_STOCK_IN",
  "SEED_SALE"
]);

function fail(code: string, detail?: string): never {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function assertExact(label: string, actual: number, expected: number) {
  if (actual !== expected) {
    fail(
      "KNOWN_NON_PRODUCTION_CLEANUP_AUTHORIZATION_MISMATCH",
      `${label} expected ${expected}, found ${actual}`
    );
  }
}

function assertZero(label: string, actual: number) {
  if (actual !== 0) {
    fail(
      "KNOWN_NON_PRODUCTION_CLEANUP_CROSS_BOUNDARY_REFERENCE",
      `${label} must be 0, found ${actual}`
    );
  }
}

function identityKey(row: { id: string; sku: string; barcode?: string | null }) {
  return `${row.id}\u0000${row.sku}\u0000${row.barcode ?? ""}`;
}

export async function executeKnownNonProductionCatalogCleanup(input: {
  client: KnownNonProductionCleanupClient;
  authorization: KnownNonProductionCleanupAuthorization;
}): Promise<KnownNonProductionCleanupResult> {
  return input.client.$transaction(async (tx) => {
    const devIds = input.authorization.developmentSeeds.map((row) => row.id);
    const legacyIds = input.authorization.legacyRuntimeQa.map((row) => row.id);
    const cleanupIds = [...devIds, ...legacyIds];
    const cleanupIdSet = new Set(cleanupIds);
    const devIdSet = new Set(devIds);
    const legacyIdSet = new Set(legacyIds);

    if (cleanupIdSet.size !== cleanupIds.length) {
      fail(
        "KNOWN_NON_PRODUCTION_CLEANUP_IDENTITY_MISMATCH",
        "approved cleanup identities contain duplicate ids"
      );
    }

    const productRows = await tx.product.findMany({
      where: { id: { in: cleanupIds } },
      select: { id: true, sku: true, barcode: true, recordSource: true },
      orderBy: { id: "asc" }
    });

    assertExact("approved products", productRows.length, cleanupIds.length);

    const expectedIdentityKeys = new Set([
      ...input.authorization.developmentSeeds.map((row) => identityKey(row)),
      ...input.authorization.legacyRuntimeQa.map((row) => identityKey(row))
    ]);

    for (const product of productRows) {
      if (product.recordSource !== "CATALOG") {
        fail(
          "KNOWN_NON_PRODUCTION_CLEANUP_IDENTITY_MISMATCH",
          `product ${product.id} recordSource expected CATALOG, found ${product.recordSource}`
        );
      }
      if (!expectedIdentityKeys.has(identityKey(product))) {
        fail(
          "KNOWN_NON_PRODUCTION_CLEANUP_IDENTITY_MISMATCH",
          `product ${product.id} no longer matches its approved id/sku/barcode identity`
        );
      }
    }

    const duplicateRows = await tx.productDuplicateCandidate.findMany({
      where: {
        OR: [
          { leftProductId: { in: cleanupIds } },
          { rightProductId: { in: cleanupIds } }
        ]
      },
      select: { id: true, leftProductId: true, rightProductId: true },
      orderBy: { id: "asc" }
    });
    assertExact(
      "product duplicate candidates",
      duplicateRows.length,
      input.authorization.expectedProductDuplicateCandidates
    );
    const crossBoundaryDuplicate = duplicateRows.find(
      (row) =>
        !cleanupIdSet.has(row.leftProductId) ||
        !cleanupIdSet.has(row.rightProductId)
    );
    if (crossBoundaryDuplicate) {
      fail(
        "KNOWN_NON_PRODUCTION_CLEANUP_CROSS_BOUNDARY_REFERENCE",
        `duplicate ${crossBoundaryDuplicate.id} crosses outside the approved cleanup ids`
      );
    }

    const aliasRows = await tx.productAlias.findMany({
      where: { canonicalProductId: { in: cleanupIds } },
      select: { id: true, canonicalProductId: true },
      orderBy: { id: "asc" }
    });
    assertExact(
      "product aliases",
      aliasRows.length,
      input.authorization.expectedProductAliases
    );
    if (aliasRows.some((row) => !cleanupIdSet.has(row.canonicalProductId))) {
      fail(
        "KNOWN_NON_PRODUCTION_CLEANUP_CROSS_BOUNDARY_REFERENCE",
        "alias escaped the approved cleanup ids"
      );
    }

    const cleanupSaleItems = await tx.saleItem.findMany({
      where: { productId: { in: cleanupIds } },
      select: { saleId: true, productId: true }
    });
    assertExact(
      "sale items",
      cleanupSaleItems.length,
      input.authorization.expectedSaleItems
    );
    const devSaleItem = cleanupSaleItems.find((row) => devIdSet.has(row.productId));
    if (devSaleItem) {
      fail(
        "KNOWN_NON_PRODUCTION_CLEANUP_CROSS_BOUNDARY_REFERENCE",
        `development seed ${devSaleItem.productId} unexpectedly participates in sale ${devSaleItem.saleId}`
      );
    }
    const unexpectedSaleProduct = cleanupSaleItems.find(
      (row) => !legacyIdSet.has(row.productId)
    );
    if (unexpectedSaleProduct) {
      fail(
        "KNOWN_NON_PRODUCTION_CLEANUP_CROSS_BOUNDARY_REFERENCE",
        `sale item references unexpected cleanup product ${unexpectedSaleProduct.productId}`
      );
    }

    const touchedSaleIds = [...new Set(cleanupSaleItems.map((row) => row.saleId))];
    assertExact("touched sales", touchedSaleIds.length, input.authorization.expectedSales);

    const allTouchedSaleItems =
      touchedSaleIds.length === 0
        ? []
        : await tx.saleItem.findMany({
            where: { saleId: { in: touchedSaleIds } },
            select: { saleId: true, productId: true }
          });
    const mixedSaleItem = allTouchedSaleItems.find(
      (row) => !cleanupIdSet.has(row.productId)
    );
    if (mixedSaleItem) {
      fail(
        "KNOWN_NON_PRODUCTION_CLEANUP_MIXED_SALE",
        `sale ${mixedSaleItem.saleId} contains operational product ${mixedSaleItem.productId}`
      );
    }

    const movementRows = await tx.inventoryMovement.findMany({
      where: { productId: { in: cleanupIds } },
      select: {
        id: true,
        productId: true,
        type: true,
        referenceType: true,
        referenceId: true
      },
      orderBy: { id: "asc" }
    });
    assertExact(
      "inventory movements",
      movementRows.length,
      input.authorization.expectedInventoryMovements
    );

    const devMovementRows = movementRows.filter((row) => devIdSet.has(row.productId));
    const legacyMovementRows = movementRows.filter((row) => legacyIdSet.has(row.productId));
    assertExact(
      "development seed movements",
      devMovementRows.length,
      input.authorization.expectedDevelopmentSeedMovements
    );
    assertExact(
      "legacy runtime QA sale movements",
      legacyMovementRows.length,
      input.authorization.expectedLegacySaleMovements
    );

    const unownedDevelopmentMovement = devMovementRows.find(
      (row) => !ALLOWED_DEVELOPMENT_MOVEMENT_REFERENCE_TYPES.has(row.referenceType ?? "")
    );
    if (unownedDevelopmentMovement) {
      fail(
        "KNOWN_NON_PRODUCTION_CLEANUP_UNOWNED_MOVEMENT",
        `development movement ${unownedDevelopmentMovement.id} has referenceType ${unownedDevelopmentMovement.referenceType ?? "null"}`
      );
    }

    const touchedSaleIdSet = new Set(touchedSaleIds);
    const unownedLegacyMovement = legacyMovementRows.find(
      (row) =>
        row.type !== "SALE" ||
        row.referenceType !== "SALE" ||
        !row.referenceId ||
        !touchedSaleIdSet.has(row.referenceId)
    );
    if (unownedLegacyMovement) {
      fail(
        "KNOWN_NON_PRODUCTION_CLEANUP_UNOWNED_MOVEMENT",
        `legacy movement ${unownedLegacyMovement.id} is not tied to an approved touched sale`
      );
    }

    const [
      persistedSaleCount,
      inventoryCount,
      batchCount,
      auditBoth,
      auditCanonicalOnly,
      auditEntityOnly,
      mappingsAsSource,
      mappingsAsCanonical,
      sarimaMappings,
      forecasts,
      recommendations,
      historicalMonthlySales,
      historicalImportRows,
      customerOrderItems,
      reviews,
      images
    ] = await Promise.all([
      tx.sale.count({ where: { id: { in: touchedSaleIds } } }),
      tx.inventory.count({ where: { productId: { in: cleanupIds } } }),
      tx.inventoryBatch.count({ where: { productId: { in: cleanupIds } } }),
      tx.catalogAuditLog.count({
        where: {
          canonicalProductId: { in: cleanupIds },
          entityId: { in: cleanupIds }
        }
      }),
      tx.catalogAuditLog.count({
        where: {
          canonicalProductId: { in: cleanupIds },
          NOT: { entityId: { in: cleanupIds } }
        }
      }),
      tx.catalogAuditLog.count({
        where: {
          entityId: { in: cleanupIds },
          NOT: { canonicalProductId: { in: cleanupIds } }
        }
      }),
      tx.productCanonicalMapping.count({ where: { sourceProductId: { in: cleanupIds } } }),
      tx.productCanonicalMapping.count({ where: { canonicalProductId: { in: cleanupIds } } }),
      tx.sarimaSourceProductMapping.count({ where: { canonicalProductId: { in: cleanupIds } } }),
      tx.forecastRecord.count({ where: { productId: { in: cleanupIds } } }),
      tx.recommendationRecord.count({ where: { productId: { in: cleanupIds } } }),
      tx.historicalMonthlySales.count({ where: { productId: { in: cleanupIds } } }),
      tx.historicalSalesImportRow.count({ where: { matchedProductId: { in: cleanupIds } } }),
      tx.customerOrderItem.count({ where: { productId: { in: cleanupIds } } }),
      tx.productReview.count({ where: { productId: { in: cleanupIds } } }),
      tx.productImageAsset.count({ where: { productId: { in: cleanupIds } } })
    ]);

    assertExact("persisted touched sales", persistedSaleCount, input.authorization.expectedSales);
    assertExact("inventories", inventoryCount, input.authorization.expectedInventories);
    assertExact("inventory batches", batchCount, input.authorization.expectedInventoryBatches);
    assertExact(
      "fixture-owned catalog audit logs",
      auditBoth,
      input.authorization.expectedCatalogAuditLogs
    );

    assertZero("cross-boundary canonical audit logs", auditCanonicalOnly);
    assertZero("cross-boundary entity audit logs", auditEntityOnly);
    assertZero("canonical mappings as source", mappingsAsSource);
    assertZero("canonical mappings as canonical", mappingsAsCanonical);
    assertZero("SARIMA mappings", sarimaMappings);
    assertZero("forecast records", forecasts);
    assertZero("recommendation records", recommendations);
    assertZero("historical monthly sales", historicalMonthlySales);
    assertZero("historical sales import rows", historicalImportRows);
    assertZero("customer order items", customerOrderItems);
    assertZero("product reviews", reviews);
    assertZero("product image assets", images);

    const deletedDuplicates = await tx.productDuplicateCandidate.deleteMany({
      where: { id: { in: duplicateRows.map((row) => row.id) } }
    });
    const deletedAliases = await tx.productAlias.deleteMany({
      where: { id: { in: aliasRows.map((row) => row.id) } }
    });
    const deletedAuditLogs = await tx.catalogAuditLog.deleteMany({
      where: {
        canonicalProductId: { in: cleanupIds },
        entityId: { in: cleanupIds }
      }
    });
    const deletedMovements = await tx.inventoryMovement.deleteMany({
      where: { productId: { in: cleanupIds } }
    });
    const deletedSales = await tx.sale.deleteMany({
      where: { id: { in: touchedSaleIds } }
    });
    const deletedBatches = await tx.inventoryBatch.deleteMany({
      where: { productId: { in: cleanupIds } }
    });
    const deletedInventories = await tx.inventory.deleteMany({
      where: { productId: { in: cleanupIds } }
    });
    const deletedProducts = await tx.product.deleteMany({
      where: {
        id: { in: cleanupIds },
        recordSource: "CATALOG"
      }
    });

    assertExact(
      "deleted product duplicate candidates",
      deletedDuplicates.count,
      input.authorization.expectedProductDuplicateCandidates
    );
    assertExact(
      "deleted product aliases",
      deletedAliases.count,
      input.authorization.expectedProductAliases
    );
    assertExact(
      "deleted catalog audit logs",
      deletedAuditLogs.count,
      input.authorization.expectedCatalogAuditLogs
    );
    assertExact(
      "deleted inventory movements",
      deletedMovements.count,
      input.authorization.expectedInventoryMovements
    );
    assertExact("deleted sales", deletedSales.count, input.authorization.expectedSales);
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
    assertExact("deleted products", deletedProducts.count, cleanupIds.length);

    return {
      summary: {
        deletedProductDuplicateCandidates: deletedDuplicates.count,
        deletedProductAliases: deletedAliases.count,
        deletedCatalogAuditLogs: deletedAuditLogs.count,
        deletedInventoryMovements: deletedMovements.count,
        deletedSales: deletedSales.count,
        deletedSaleItemsViaCascade: cleanupSaleItems.length,
        deletedInventoryBatches: deletedBatches.count,
        deletedInventories: deletedInventories.count,
        deletedProducts: deletedProducts.count
      }
    };
  });
}
