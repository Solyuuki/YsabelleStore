import assert from "node:assert/strict";

import { PrismaClient } from "@prisma/client";

import { loadHistoricalSalesData } from "../modules/forecasting/historical-sales.service.js";
import {
  SARIMA_CATALOG_CANDIDATES,
  type SarimaCatalogCandidate
} from "../modules/forecasting/sarima-catalog-candidates.js";
import { normalizeProductIdentity } from "../utils/catalogIdentity.js";

const prisma = new PrismaClient();

function sourceKey(sourceProductId: string) {
  return `workbook:${sourceProductId}`;
}

async function main() {
  try {
    const historical = await loadHistoricalSalesData();
    assert(historical.validation.valid, "Historical workbook validation must pass.");
    const sourceById = new Map(historical.products.map((product) => [product.productId, product]));
    const activeBatches = await prisma.forecastBatchCache.findMany({
      select: { id: true },
      take: 2,
      where: { isActive: true, status: "READY" }
    });
    assert.equal(activeBatches.length, 1, "Expected exactly one active READY forecast batch.");
    const activeBatch = activeBatches[0];
    assert(activeBatch, "Expected an active READY forecast batch.");

    const [mappings, forecasts, products, inventoryBatches] = await Promise.all([
      prisma.sarimaSourceProductMapping.findMany({
        include: { canonicalProduct: true },
        orderBy: { sourceProductId: "asc" },
        where: {
          sourceProductId: { in: SARIMA_CATALOG_CANDIDATES.map((item) => item.sourceProductId) }
        }
      }),
      prisma.forecastProductResult.findMany({
        select: { modelName: true, resultStatus: true, sourceProductId: true },
        where: {
          batchId: activeBatch.id,
          sourceProductId: {
            in: SARIMA_CATALOG_CANDIDATES.map((item) => sourceKey(item.sourceProductId))
          }
        }
      }),
      prisma.product.findMany({
        include: { inventory: true },
        where: { id: { in: SARIMA_CATALOG_CANDIDATES.map((item) => item.id) } }
      }),
      prisma.inventoryBatch.count({
        where: { productId: { in: SARIMA_CATALOG_CANDIDATES.map((item) => item.id) } }
      })
    ]);

    assert.equal(mappings.length, SARIMA_CATALOG_CANDIDATES.length);
    assert.equal(forecasts.length, SARIMA_CATALOG_CANDIDATES.length);
    assert.equal(products.length, SARIMA_CATALOG_CANDIDATES.length);
    assert.equal(inventoryBatches, 0, "The mapper must not fabricate inventory batches.");

    const mappingBySourceId = new Map(
      mappings.map((mapping) => [mapping.sourceProductId, mapping])
    );
    const forecastBySourceKey = new Map(
      forecasts.map((forecast) => [forecast.sourceProductId, forecast])
    );
    const productById = new Map(products.map((product) => [product.id, product]));

    for (const candidate of SARIMA_CATALOG_CANDIDATES) {
      assertCandidate(candidate, sourceById, mappingBySourceId, forecastBySourceKey, productById);
    }

    console.info(
      JSON.stringify(
        {
          activeForecastBatchId: activeBatch.id,
          highConfidenceMappings: mappings.length,
          inventoryBatches,
          sarimaReadyResults: forecasts.length,
          storefrontVisibleProducts: products.filter((product) => product.isStorefrontVisible)
            .length
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

function assertCandidate(
  candidate: SarimaCatalogCandidate,
  sourceById: Map<string, Awaited<ReturnType<typeof loadHistoricalSalesData>>["products"][number]>,
  mappingBySourceId: Map<
    string,
    {
      canonicalProductId: string;
      confidence: string;
      sourceKey: string;
      sourceProductName: string;
      historicalMonthCount: number;
      canonicalProduct: { id: string };
    }
  >,
  forecastBySourceKey: Map<string, { modelName: string | null; resultStatus: string }>,
  productById: Map<
    string,
    {
      id: string;
      barcode: string | null;
      costPrice: unknown;
      inventory: unknown;
      isStorefrontVisible: boolean;
      name: string;
      sku: string;
      status: string;
    }
  >
) {
  const source = sourceById.get(candidate.sourceProductId);
  const mapping = mappingBySourceId.get(candidate.sourceProductId);
  const forecast = forecastBySourceKey.get(sourceKey(candidate.sourceProductId));
  const product = productById.get(candidate.id);

  assert(source, `Missing workbook source ${candidate.sourceProductId}.`);
  assert.equal(source.historical.length, 24, `${candidate.sourceProductId} must retain 24 months.`);
  assert(mapping, `Missing persisted map for ${candidate.sourceProductId}.`);
  assert.equal(mapping.confidence, "HIGH");
  assert.equal(mapping.sourceKey, sourceKey(candidate.sourceProductId));
  assert.equal(mapping.canonicalProductId, candidate.id);
  assert.equal(mapping.canonicalProduct.id, candidate.id);
  assert.equal(mapping.historicalMonthCount, 24);
  assert.equal(
    normalizeProductIdentity(mapping.sourceProductName),
    normalizeProductIdentity(source.productName)
  );
  assert(forecast, `Missing active forecast for ${candidate.sourceProductId}.`);
  assert.equal(forecast.modelName, "SARIMA");
  assert.equal(forecast.resultStatus, "READY");
  assert(product, `Missing canonical product ${candidate.id}.`);
  assert.equal(product.sku, candidate.sku);
  assert.equal(product.name, candidate.canonicalName);
  assert.equal(product.barcode, null, "No GTIN may be fabricated.");
  assert.equal(product.costPrice, null, "No procurement cost may be fabricated.");
  assert.equal(product.inventory, null, "No inventory summary may be fabricated.");
  assert.equal(product.status, "ACTIVE");
  assert.equal(product.isStorefrontVisible, true);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
