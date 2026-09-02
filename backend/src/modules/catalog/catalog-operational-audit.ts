import type { CatalogPromotionPreview } from "./catalog-promotion-preview.js";
import { isDevelopmentCatalogSeedProduct } from "./development-catalog-seed-identities.js";
import { isLegacyRuntimeQaProduct } from "./legacy-runtime-qa-identities.js";
import { normalizeSarimaSourceName } from "./sarima-source-manifest.js";

export type OperationalProductRecordSource = "CATALOG" | "IMPORT" | "TEST_FIXTURE" | "INTERNAL";
export type OperationalProductQualityStatus = "APPROVED" | "NEEDS_REVIEW" | "REJECTED";

export type OperationalRelationshipCounts = {
  inventoryBatches: number;
  inventoryMovements: number;
  saleItems: number;
  forecastRecords: number;
  recommendationRecords: number;
  historicalMonthlySales: number;
  historicalSalesImportRows: number;
  customerOrderItems: number;
  productReviews: number;
  imageAssets: number;
};

export type OperationalProductSnapshot = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  recordSource: OperationalProductRecordSource;
  dataQualityStatus: OperationalProductQualityStatus;
  sarimaSourceProductId: string | null;
  rawNameAliases: string[];
  hasInventoryRecord: boolean;
  relationshipCounts: OperationalRelationshipCounts;
};

export type OperationalCatalogCandidateStatus =
  | "EXISTING"
  | "NEW"
  | "DUPLICATE_ALIAS"
  | "BLOCKED";

export type OperationalCatalogCandidateRow = {
  productCode: string;
  sourceName: string;
  canonicalProductCode: string;
  status: OperationalCatalogCandidateStatus;
  operationalProductId: string | null;
  candidateOperationalProductIds: string[];
  reason: string;
};

export type OperationalFixtureRow = {
  productId: string;
  sku: string;
  name: string;
  protectedReferenceCount: number;
  relationshipCounts: OperationalRelationshipCounts;
  hasInventoryRecord: boolean;
};

export type UnmatchedOperationalProductRow = {
  productId: string;
  sku: string;
  barcode: string | null;
  name: string;
  recordSource: OperationalProductRecordSource;
  dataQualityStatus: OperationalProductQualityStatus;
  hasInventoryRecord: boolean;
  relationshipCounts: OperationalRelationshipCounts;
  protectedReferenceCount: number;
};

export type OperationalCatalogAudit = {
  summary: {
    promotionCandidates: number;
    existing: number;
    new: number;
    duplicateAliases: number;
    blocked: number;
    testFixtures: number;
    testFixturesWithProtectedReferences: number;
    developmentSeedProducts: number;
    developmentSeedProductsWithProtectedReferences: number;
    legacyRuntimeQaProducts: number;
    legacyRuntimeQaProductsWithProtectedReferences: number;
    unmatchedOperationalProducts: number;
  };
  candidateRows: OperationalCatalogCandidateRow[];
  testFixtures: OperationalFixtureRow[];
  developmentSeedProducts: OperationalFixtureRow[];
  legacyRuntimeQaProducts: OperationalFixtureRow[];
  unmatchedOperationalProducts: UnmatchedOperationalProductRow[];
};

function protectedReferenceCount(product: OperationalProductSnapshot) {
  return (
    (product.hasInventoryRecord ? 1 : 0) +
    Object.values(product.relationshipCounts).reduce((total, count) => total + count, 0)
  );
}

function normalizedNames(product: OperationalProductSnapshot) {
  return new Set(
    [product.name, ...product.rawNameAliases]
      .map((value) => normalizeSarimaSourceName(value))
      .filter(Boolean)
  );
}

function toQuarantineRow(product: OperationalProductSnapshot): OperationalFixtureRow {
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    protectedReferenceCount: protectedReferenceCount(product),
    relationshipCounts: product.relationshipCounts,
    hasInventoryRecord: product.hasInventoryRecord
  };
}

export function buildOperationalCatalogAudit(
  preview: CatalogPromotionPreview,
  products: OperationalProductSnapshot[]
): OperationalCatalogAudit {
  const fixtures = products.filter((product) => product.recordSource === "TEST_FIXTURE");
  const developmentSeeds = products.filter(
    (product) =>
      product.recordSource !== "TEST_FIXTURE" && isDevelopmentCatalogSeedProduct(product)
  );
  const legacyRuntimeQaProducts = products.filter(
    (product) =>
      product.recordSource !== "TEST_FIXTURE" &&
      !isDevelopmentCatalogSeedProduct(product) &&
      isLegacyRuntimeQaProduct(product)
  );
  const operationalProducts = products.filter(
    (product) =>
      product.recordSource !== "TEST_FIXTURE" &&
      !isDevelopmentCatalogSeedProduct(product) &&
      !isLegacyRuntimeQaProduct(product)
  );
  const usedOperationalProductIds = new Set<string>();
  const candidateOperationalProductIds = new Set<string>();

  const sourceMappingIndex = new Map<string, OperationalProductSnapshot[]>();
  for (const product of products) {
    if (!product.sarimaSourceProductId) continue;
    const values = sourceMappingIndex.get(product.sarimaSourceProductId) ?? [];
    values.push(product);
    sourceMappingIndex.set(product.sarimaSourceProductId, values);
  }

  const nameIndex = new Map<string, OperationalProductSnapshot[]>();
  for (const product of operationalProducts) {
    for (const normalizedName of normalizedNames(product)) {
      const values = nameIndex.get(normalizedName) ?? [];
      if (!values.some((value) => value.id === product.id)) {
        values.push(product);
      }
      nameIndex.set(normalizedName, values);
    }
  }

  const candidateRows = preview.rows.map((row): OperationalCatalogCandidateRow => {
    if (row.identityStatus === "DUPLICATE_ALIAS") {
      return {
        productCode: row.productCode,
        sourceName: row.sourceName,
        canonicalProductCode: row.canonicalProductCode,
        status: "DUPLICATE_ALIAS",
        operationalProductId: null,
        candidateOperationalProductIds: [],
        reason: `Historical source identity aliases canonical candidate ${row.canonicalProductCode}; do not create a second Product.`
      };
    }

    if (row.identityStatus === "BLOCKED_REVIEW") {
      const normalizedSourceName = normalizeSarimaSourceName(row.sourceName);
      const nameCandidates = (nameIndex.get(normalizedSourceName) ?? []).sort((left, right) =>
        left.id.localeCompare(right.id)
      );
      const ids = nameCandidates.map((product) => product.id);
      ids.forEach((id) => candidateOperationalProductIds.add(id));

      return {
        productCode: row.productCode,
        sourceName: row.sourceName,
        canonicalProductCode: row.canonicalProductCode,
        status: "BLOCKED",
        operationalProductId: null,
        candidateOperationalProductIds: ids,
        reason:
          ids.length > 0
            ? "Historical identity remains blocked for manual canonical review; matching operational Product candidates are surfaced for review but are not auto-mapped."
            : "Historical identity remains blocked for manual canonical review before operational promotion."
      };
    }

    const directlyMapped = sourceMappingIndex.get(row.productCode) ?? [];
    const mappedFixtures = directlyMapped.filter((product) => product.recordSource === "TEST_FIXTURE");
    const mappedDevelopmentSeeds = directlyMapped.filter(
      (product) =>
        product.recordSource !== "TEST_FIXTURE" && isDevelopmentCatalogSeedProduct(product)
    );
    const mappedLegacyRuntimeQaProducts = directlyMapped.filter(
      (product) =>
        product.recordSource !== "TEST_FIXTURE" &&
        !isDevelopmentCatalogSeedProduct(product) &&
        isLegacyRuntimeQaProduct(product)
    );
    const mappedOperational = directlyMapped.filter(
      (product) =>
        product.recordSource !== "TEST_FIXTURE" &&
        !isDevelopmentCatalogSeedProduct(product) &&
        !isLegacyRuntimeQaProduct(product)
    );

    if (mappedFixtures.length > 0) {
      return {
        productCode: row.productCode,
        sourceName: row.sourceName,
        canonicalProductCode: row.canonicalProductCode,
        status: "BLOCKED",
        operationalProductId: null,
        candidateOperationalProductIds: mappedFixtures.map((product) => product.id).sort(),
        reason: "SARIMA source mapping points to a test fixture Product; mapping must be repaired before promotion."
      };
    }

    if (mappedDevelopmentSeeds.length > 0) {
      return {
        productCode: row.productCode,
        sourceName: row.sourceName,
        canonicalProductCode: row.canonicalProductCode,
        status: "BLOCKED",
        operationalProductId: null,
        candidateOperationalProductIds: mappedDevelopmentSeeds.map((product) => product.id).sort(),
        reason: "SARIMA source mapping points to a known development seed Product; mapping must be reviewed before promotion."
      };
    }

    if (mappedLegacyRuntimeQaProducts.length > 0) {
      return {
        productCode: row.productCode,
        sourceName: row.sourceName,
        canonicalProductCode: row.canonicalProductCode,
        status: "BLOCKED",
        operationalProductId: null,
        candidateOperationalProductIds: mappedLegacyRuntimeQaProducts.map((product) => product.id).sort(),
        reason: "SARIMA source mapping points to a provenance-proven legacy runtime QA Product; mapping must be reviewed before promotion."
      };
    }

    if (mappedOperational.length === 1) {
      const product = mappedOperational[0]!;
      usedOperationalProductIds.add(product.id);
      return {
        productCode: row.productCode,
        sourceName: row.sourceName,
        canonicalProductCode: row.canonicalProductCode,
        status: "EXISTING",
        operationalProductId: product.id,
        candidateOperationalProductIds: [product.id],
        reason: "Existing operational Product is proven by its SARIMA source mapping."
      };
    }

    if (mappedOperational.length > 1) {
      const ids = mappedOperational.map((product) => product.id).sort();
      ids.forEach((id) => candidateOperationalProductIds.add(id));
      return {
        productCode: row.productCode,
        sourceName: row.sourceName,
        canonicalProductCode: row.canonicalProductCode,
        status: "BLOCKED",
        operationalProductId: null,
        candidateOperationalProductIds: ids,
        reason: "Multiple operational Products claim the same SARIMA source identity; manual mapping repair is required."
      };
    }

    const normalizedSourceName = normalizeSarimaSourceName(row.sourceName);
    const nameCandidates = (nameIndex.get(normalizedSourceName) ?? []).sort((left, right) =>
      left.id.localeCompare(right.id)
    );

    if (nameCandidates.length > 0) {
      const ids = nameCandidates.map((product) => product.id);
      ids.forEach((id) => candidateOperationalProductIds.add(id));
      return {
        productCode: row.productCode,
        sourceName: row.sourceName,
        canonicalProductCode: row.canonicalProductCode,
        status: "BLOCKED",
        operationalProductId: null,
        candidateOperationalProductIds: ids,
        reason: "One or more operational Products match only by normalized name/alias; name evidence alone is insufficient to auto-map."
      };
    }

    return {
      productCode: row.productCode,
      sourceName: row.sourceName,
      canonicalProductCode: row.canonicalProductCode,
      status: "NEW",
      operationalProductId: null,
      candidateOperationalProductIds: [],
      reason: "No existing operational Product mapping or defensible identifier-backed match was found."
    };
  });

  const fixtureRows = fixtures
    .map(toQuarantineRow)
    .sort((left, right) => left.productId.localeCompare(right.productId));
  const developmentSeedRows = developmentSeeds
    .map(toQuarantineRow)
    .sort((left, right) => left.productId.localeCompare(right.productId));
  const legacyRuntimeQaRows = legacyRuntimeQaProducts
    .map(toQuarantineRow)
    .sort((left, right) => left.productId.localeCompare(right.productId));

  const unmatchedOperationalProducts = operationalProducts
    .filter(
      (product) =>
        !usedOperationalProductIds.has(product.id) &&
        !candidateOperationalProductIds.has(product.id)
    )
    .map((product): UnmatchedOperationalProductRow => ({
      productId: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      recordSource: product.recordSource,
      dataQualityStatus: product.dataQualityStatus,
      hasInventoryRecord: product.hasInventoryRecord,
      relationshipCounts: product.relationshipCounts,
      protectedReferenceCount: protectedReferenceCount(product)
    }))
    .sort((left, right) => left.productId.localeCompare(right.productId));

  return {
    summary: {
      promotionCandidates: preview.rows.length,
      existing: candidateRows.filter((row) => row.status === "EXISTING").length,
      new: candidateRows.filter((row) => row.status === "NEW").length,
      duplicateAliases: candidateRows.filter((row) => row.status === "DUPLICATE_ALIAS").length,
      blocked: candidateRows.filter((row) => row.status === "BLOCKED").length,
      testFixtures: fixtureRows.length,
      testFixturesWithProtectedReferences: fixtureRows.filter(
        (row) => row.protectedReferenceCount > 0
      ).length,
      developmentSeedProducts: developmentSeedRows.length,
      developmentSeedProductsWithProtectedReferences: developmentSeedRows.filter(
        (row) => row.protectedReferenceCount > 0
      ).length,
      legacyRuntimeQaProducts: legacyRuntimeQaRows.length,
      legacyRuntimeQaProductsWithProtectedReferences: legacyRuntimeQaRows.filter(
        (row) => row.protectedReferenceCount > 0
      ).length,
      unmatchedOperationalProducts: unmatchedOperationalProducts.length
    },
    candidateRows,
    testFixtures: fixtureRows,
    developmentSeedProducts: developmentSeedRows,
    legacyRuntimeQaProducts: legacyRuntimeQaRows,
    unmatchedOperationalProducts
  };
}
