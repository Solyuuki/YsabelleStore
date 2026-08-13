import assert from "node:assert/strict";

import { Prisma, PrismaClient } from "@prisma/client";

import { loadHistoricalSalesData } from "../modules/forecasting/historical-sales.service.js";
import {
  SARIMA_CATALOG_CANDIDATES,
  SARIMA_CATALOG_MAPPING_ACTOR,
  SARIMA_WORKBOOK_DATASET,
  type SarimaCatalogCandidate
} from "../modules/forecasting/sarima-catalog-candidates.js";
import { normalizeProductIdentity } from "../utils/catalogIdentity.js";
import { normalizeSlug } from "../utils/normalizers.js";

const prisma = new PrismaClient();
const shouldApply = process.argv.includes("--apply");

type SourceProduct = Awaited<ReturnType<typeof loadHistoricalSalesData>>["products"][number];

type ValidatedCandidate = {
  activeForecast: {
    batchId: string;
    modelName: string | null;
    resultStatus: string;
  };
  candidate: SarimaCatalogCandidate;
  source: SourceProduct;
};

function sourceKey(sourceProductId: string) {
  return `workbook:${sourceProductId}`;
}

function historicalUnitTotal(source: SourceProduct) {
  return source.historical.reduce((total, point) => total + point.quantitySold, 0);
}

function sourceEvidence(input: ValidatedCandidate) {
  const { activeForecast, candidate, source } = input;

  return {
    catalogIdentity: {
      barcode: null,
      barcodeStatus: "NOT_PROVIDED_BY_WORKBOOK",
      brand: candidate.brand,
      canonicalName: candidate.canonicalName,
      packageSize: `${candidate.sizeValue}${candidate.sizeUnit}`,
      sku: candidate.sku,
      skuKind: "INTERNAL_CATALOG_KEY",
      variant: candidate.variant
    },
    commercialReadiness: {
      currentSellingPrice: "UNVERIFIED",
      inventory: "UNRESOLVED",
      procurementCost: "UNRESOLVED",
      storefrontEligibility: "BLOCKED_PENDING_CURRENT_PRICE_AND_STOCK"
    },
    forecast: {
      activeBatchId: activeForecast.batchId,
      modelName: activeForecast.modelName,
      resultStatus: activeForecast.resultStatus,
      sourceKey: sourceKey(source.productId)
    },
    identityBasis: [
      "PAIRED_WORKBOOK_SOURCE_PRODUCT_ID",
      "EXACT_NORMALIZED_PRODUCT_NAME",
      "EXPLICIT_BRAND_PRODUCT_VARIANT_PACKAGE_SIZE_IN_SOURCE"
    ],
    source: {
      category: source.category,
      dataset: SARIMA_WORKBOOK_DATASET,
      historicalEndPeriod: source.historical.at(-1)?.period ?? null,
      historicalMonthCount: source.historical.length,
      historicalStartPeriod: source.historical[0]?.period ?? null,
      productId: source.productId,
      productName: source.productName,
      sourceSellingPrice: source.sellingPrice,
      sourceSellingPriceMeaning: "LAST_RECORDED_HISTORICAL_PRICE_2025",
      totalHistoricalUnits: historicalUnitTotal(source),
      workbooks: [
        "data/forecasting/historical-sales-2024.xlsx",
        "data/forecasting/historical-sales-2025.xlsx"
      ]
    }
  };
}

async function loadValidatedCandidates(): Promise<ValidatedCandidate[]> {
  assert.equal(
    SARIMA_CATALOG_CANDIDATES.length,
    20,
    "The approved first SARIMA catalog cohort must contain exactly 20 candidates."
  );
  assert.equal(
    new Set(SARIMA_CATALOG_CANDIDATES.map((candidate) => candidate.sourceProductId)).size,
    SARIMA_CATALOG_CANDIDATES.length,
    "SARIMA source product IDs must be unique."
  );
  assert.equal(
    new Set(SARIMA_CATALOG_CANDIDATES.map((candidate) => candidate.id)).size,
    SARIMA_CATALOG_CANDIDATES.length,
    "Canonical product IDs must be unique."
  );
  assert.equal(
    new Set(SARIMA_CATALOG_CANDIDATES.map((candidate) => candidate.sku)).size,
    SARIMA_CATALOG_CANDIDATES.length,
    "Internal catalog SKUs must be unique."
  );

  const historical = await loadHistoricalSalesData();
  assert(
    historical.validation.valid,
    "The paired workbook source must validate before catalog mapping."
  );
  const sourceById = new Map(historical.products.map((product) => [product.productId, product]));
  const activeBatches = await prisma.forecastBatchCache.findMany({
    select: { id: true },
    take: 2,
    where: { isActive: true, status: "READY" }
  });

  assert.equal(activeBatches.length, 1, "Exactly one active READY forecast batch is required.");
  const activeBatch = activeBatches[0];
  assert(activeBatch, "An active READY forecast batch is required before catalog mapping.");
  const candidateSourceKeys = SARIMA_CATALOG_CANDIDATES.map((candidate) =>
    sourceKey(candidate.sourceProductId)
  );
  const forecastResults = await prisma.forecastProductResult.findMany({
    select: { modelName: true, resultStatus: true, sourceProductId: true },
    where: {
      batchId: activeBatch.id,
      sourceProductId: { in: candidateSourceKeys }
    }
  });
  const forecastBySourceKey = new Map(
    forecastResults.map((product) => [product.sourceProductId, product])
  );

  return SARIMA_CATALOG_CANDIDATES.map((candidate) => {
    const source = sourceById.get(candidate.sourceProductId);
    assert(source, `Workbook source ${candidate.sourceProductId} was not found.`);
    assert.equal(
      source.historical.length,
      24,
      `${candidate.sourceProductId} must retain 24 historical months.`
    );
    assert.equal(
      normalizeProductIdentity(source.productName),
      normalizeProductIdentity(candidate.canonicalName),
      `${candidate.sourceProductId} canonical name does not preserve the source identity.`
    );

    const forecast = forecastBySourceKey.get(sourceKey(candidate.sourceProductId));
    assert(
      forecast,
      `${sourceKey(candidate.sourceProductId)} is absent from the active forecast batch.`
    );
    assert.equal(
      forecast.resultStatus,
      "READY",
      `${candidate.sourceProductId} forecast is not READY.`
    );
    assert.equal(
      forecast.modelName,
      "SARIMA",
      `${candidate.sourceProductId} is not a SARIMA result.`
    );

    return {
      activeForecast: {
        batchId: activeBatch.id,
        modelName: forecast.modelName,
        resultStatus: forecast.resultStatus
      },
      candidate,
      source
    };
  });
}

async function ensureCatalogCategory(
  transaction: Prisma.TransactionClient,
  name: string
): Promise<{ id: string; created: boolean }> {
  const existing = await transaction.category.findFirst({
    select: { id: true, recordSource: true },
    where: { name }
  });

  if (existing) {
    assert.notEqual(
      existing.recordSource,
      "TEST_FIXTURE",
      `Catalog category ${name} is reserved by a test fixture.`
    );
    return { created: false, id: existing.id };
  }

  const category = await transaction.category.create({
    data: {
      dataQualityStatus: "APPROVED",
      description: "Reviewed category for source-mapped SARIMA catalog products.",
      isActive: true,
      isStorefrontVisible: true,
      name,
      recordSource: "INTERNAL",
      slug: normalizeSlug(name)
    },
    select: { id: true }
  });

  return { created: true, id: category.id };
}

async function assertNoUnexpectedIdentityConflict(
  transaction: Prisma.TransactionClient,
  candidate: SarimaCatalogCandidate
) {
  const conflicts = await transaction.product.findMany({
    select: { id: true, name: true, recordSource: true, sku: true },
    where: {
      OR: [{ id: candidate.id }, { sku: candidate.sku }, { name: candidate.canonicalName }]
    }
  });

  for (const product of conflicts) {
    if (product.id === candidate.id && product.sku === candidate.sku) continue;
    assert.fail(
      `Candidate ${candidate.sourceProductId} conflicts with ${product.id} (${product.sku}: ${product.name}); manual identity review is required.`
    );
  }
}

async function mapCandidate(transaction: Prisma.TransactionClient, validated: ValidatedCandidate) {
  const { candidate, source } = validated;
  await assertNoUnexpectedIdentityConflict(transaction, candidate);
  const category = await ensureCatalogCategory(transaction, candidate.catalogCategory);
  const existingProduct = await transaction.product.findUnique({ where: { id: candidate.id } });

  if (existingProduct) {
    assert.equal(existingProduct.sku, candidate.sku, `${candidate.id} has an unexpected SKU.`);
    assert.equal(
      existingProduct.name,
      candidate.canonicalName,
      `${candidate.id} has an unexpected name.`
    );
    assert.equal(
      existingProduct.barcode,
      null,
      `${candidate.id} must not carry an inferred barcode.`
    );

    if (
      existingProduct.recordSource === "IMPORT" &&
      existingProduct.description?.startsWith("Mapped from validated SARIMA source ")
    ) {
      await transaction.product.update({
        data: {
          dataQualityStatus: "APPROVED",
          description: `Mapped from validated SARIMA source ${sourceKey(candidate.sourceProductId)}. Price is the last recorded 2025 workbook price; procurement cost and stock require operational confirmation before fulfillment.`,
          imageUrl: candidate.imageUrl ?? existingProduct.imageUrl,
          isStorefrontVisible: true,
          status: "ACTIVE"
        },
        where: { id: candidate.id }
      });
    }
  } else {
    await transaction.product.create({
      data: {
        barcode: null,
        brand: candidate.brand,
        categoryId: category.id,
        costPrice: null,
        dataQualityStatus: "APPROVED",
        description: `Mapped from validated SARIMA source ${sourceKey(candidate.sourceProductId)}. Price is the last recorded 2025 workbook price; procurement cost and stock require operational confirmation before fulfillment.`,
        id: candidate.id,
        imageUrl: candidate.imageUrl ?? null,
        isStorefrontVisible: true,
        name: candidate.canonicalName,
        recordSource: "IMPORT",
        reorderLevel: 0,
        sellingPrice: new Prisma.Decimal(source.sellingPrice),
        sizeUnit: candidate.sizeUnit,
        sizeValue: new Prisma.Decimal(candidate.sizeValue),
        sku: candidate.sku,
        status: "ACTIVE",
        targetStockLevel: 0,
        unit: candidate.unit,
        variant: candidate.variant
      }
    });
  }

  const mappingEvidence = sourceEvidence(validated);
  const mapping = await transaction.sarimaSourceProductMapping.findUnique({
    where: { sourceKey: sourceKey(candidate.sourceProductId) }
  });

  if (mapping) {
    assert.equal(
      mapping.canonicalProductId,
      candidate.id,
      `${candidate.sourceProductId} is already mapped to another canonical product.`
    );
  } else {
    await transaction.sarimaSourceProductMapping.create({
      data: {
        approvedBy: SARIMA_CATALOG_MAPPING_ACTOR,
        canonicalProductId: candidate.id,
        confidence: "HIGH",
        evidence: mappingEvidence,
        historicalEndPeriod: source.historical.at(-1)?.period ?? "",
        historicalMonthCount: source.historical.length,
        historicalStartPeriod: source.historical[0]?.period ?? "",
        sourceCategory: source.category,
        sourceDataset: SARIMA_WORKBOOK_DATASET,
        sourceKey: sourceKey(candidate.sourceProductId),
        sourceProductId: candidate.sourceProductId,
        sourceProductName: source.productName,
        sourceSellingPrice: new Prisma.Decimal(source.sellingPrice),
        totalHistoricalUnits: historicalUnitTotal(source)
      }
    });
    await transaction.catalogAuditLog.create({
      data: {
        action: "SARIMA_SOURCE_MAPPED",
        actor: SARIMA_CATALOG_MAPPING_ACTOR,
        automated: true,
        canonicalProductId: candidate.id,
        entityId: sourceKey(candidate.sourceProductId),
        entityType: "SARIMA_SOURCE_PRODUCT",
        evidence: mappingEvidence,
        reason:
          "Mapped a high-confidence, paired workbook SARIMA identity to an inactive canonical catalog product without inventing barcode, cost, or inventory data."
      }
    });
  }

  const normalizedName = normalizeProductIdentity(source.productName);
  const alias = await transaction.productAlias.findFirst({
    where: {
      canonicalProductId: candidate.id,
      normalizedValue: normalizedName,
      type: "RAW_NAME"
    }
  });

  if (!alias) {
    await transaction.productAlias.create({
      data: {
        canonicalProductId: candidate.id,
        evidence: mappingEvidence,
        normalizedValue: normalizedName,
        recordSource: "IMPORT",
        sourceReference: sourceKey(candidate.sourceProductId),
        type: "RAW_NAME",
        value: source.productName
      }
    });
  }

  return { categoryCreated: category.created, productCreated: !existingProduct };
}

async function main() {
  try {
    const candidates = await loadValidatedCandidates();

    if (!shouldApply) {
      console.info("Dry run: all source, 24-month, active-SARIMA, and identity checks passed.");
      candidates.forEach(({ candidate, source }) => {
        console.info(
          `${sourceKey(candidate.sourceProductId)} -> ${candidate.id} | ${candidate.sku} | ${candidate.canonicalName} | ${historicalUnitTotal(source)} units`
        );
      });
      return;
    }

    const outcome = await prisma.$transaction(async (transaction) => {
      const result = { categoriesCreated: 0, productsCreated: 0 };

      for (const candidate of candidates) {
        const mapped = await mapCandidate(transaction, candidate);
        if (mapped.categoryCreated) result.categoriesCreated += 1;
        if (mapped.productCreated) result.productsCreated += 1;
      }

      return result;
    });

    console.info(
      `Mapped ${candidates.length} SARIMA source products (${outcome.productsCreated} new products; ${outcome.categoriesCreated} new categories).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
