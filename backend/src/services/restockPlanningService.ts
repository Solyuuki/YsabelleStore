import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { buildPaginationMeta } from "../utils/pagination.js";
import type {
  DismissRestockRecommendationRequest,
  RestockPlanningQuery
} from "../validators/restock.validators.js";
import { getIncomingRestockStock } from "./restockService.js";
import { calculateStockTruth } from "./stockTruth.js";

function latestByProduct<T extends { productId: string }>(rows: T[]) {
  const byProduct = new Map<string, T>();
  for (const row of rows) {
    if (!byProduct.has(row.productId)) byProduct.set(row.productId, row);
  }
  return byProduct;
}

export async function listRestockPlanningCandidates(query: RestockPlanningQuery) {
  const products = await prisma.product.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    where: {
      dataQualityStatus: { not: "REJECTED" },
      recordSource: { not: "TEST_FIXTURE" },
      status: { not: "DISCONTINUED" },
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { sku: { contains: query.search } },
              { barcode: { contains: query.search } },
              { barcodes: { some: { barcode: { contains: query.search } } } }
            ]
          }
        : {})
    },
    select: {
      barcode: true,
      id: true,
      inventoryBatches: {
        select: {
          expiresAt: true,
          quantityRemaining: true,
          status: true
        }
      },
      name: true,
      reorderLevel: true,
      sku: true,
      targetStockLevel: true
    }
  });
  const productIds = products.map((product) => product.id);
  const incomingByProduct = await getIncomingRestockStock(productIds);

  const recommendations = productIds.length
    ? await prisma.recommendationRecord.findMany({
        orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
        select: {
          forecastRecordId: true,
          generatedAt: true,
          id: true,
          productId: true,
          reason: true,
          recommendedQuantity: true,
          type: true
        },
        where: {
          productId: { in: productIds },
          status: "OPEN",
          type: { in: ["RESTOCK", "LOW_STOCK"] }
        }
      })
    : [];
  const latestRecommendation = latestByProduct(recommendations);

  const activeForecast = await prisma.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    select: {
      id: true,
      source: true,
      products: {
        select: {
          currentMonthForecastQuantity: true,
          modelName: true,
          sourceProductId: true
        }
      }
    },
    where: {
      isActive: true,
      status: "READY"
    }
  });

  const workbookSourceIds =
    activeForecast?.source === "WORKBOOK_FALLBACK"
      ? activeForecast.products.map((product) => product.sourceProductId)
      : [];
  const workbookMappings = workbookSourceIds.length
    ? await prisma.sarimaSourceProductMapping.findMany({
        select: {
          canonicalProductId: true,
          sourceProductId: true
        },
        where: { sourceProductId: { in: workbookSourceIds } }
      })
    : [];
  const workbookCanonicalBySource = new Map(
    workbookMappings.map((mapping) => [mapping.sourceProductId, mapping.canonicalProductId])
  );
  const forecastByCanonicalProduct = new Map<
    string,
    { currentMonthForecastQuantity: number | null; modelName: string | null }
  >();

  for (const forecastProduct of activeForecast?.products ?? []) {
    const canonicalProductId =
      activeForecast?.source === "DATABASE"
        ? forecastProduct.sourceProductId
        : workbookCanonicalBySource.get(forecastProduct.sourceProductId);
    if (!canonicalProductId) continue;

    forecastByCanonicalProduct.set(canonicalProductId, {
      currentMonthForecastQuantity:
        forecastProduct.currentMonthForecastQuantity === null
          ? null
          : Number(forecastProduct.currentMonthForecastQuantity),
      modelName: forecastProduct.modelName
    });
  }

  const candidates = products.map((product) => {
    const stockTruth = calculateStockTruth(product.inventoryBatches);
    const incomingStock = incomingByProduct.get(product.id) ?? 0;
    const recommendation = latestRecommendation.get(product.id);
    const forecast = forecastByCanonicalProduct.get(product.id) ?? null;
    let recommendationId: string | null = null;
    let recommendationSource: "SARIMA" | "LOW_STOCK" | "TARGET_STOCK" = "TARGET_STOCK";
    let recommendedQuantity = 0;
    let rationale = "No replenishment is currently required by the stock policy.";

    if (
      recommendation?.recommendedQuantity !== null &&
      recommendation?.recommendedQuantity !== undefined
    ) {
      recommendationId = recommendation.id;
      recommendationSource = recommendation.forecastRecordId
        ? "SARIMA"
        : recommendation.type === "LOW_STOCK"
          ? "LOW_STOCK"
          : "TARGET_STOCK";
      recommendedQuantity = Math.max(0, recommendation.recommendedQuantity - incomingStock);
      rationale = recommendation.reason;
    } else {
      const targetGap = Math.max(
        0,
        product.targetStockLevel - stockTruth.sellableStock - incomingStock
      );
      const lowStockMinimum =
        product.reorderLevel > 0 && stockTruth.sellableStock <= product.reorderLevel
          ? Math.max(0, product.reorderLevel + 1 - stockTruth.sellableStock - incomingStock)
          : 0;

      if (targetGap > 0) {
        recommendationSource = "TARGET_STOCK";
        recommendedQuantity = targetGap;
        rationale = `Restore sellable stock toward the target level of ${product.targetStockLevel}.`;
      } else if (lowStockMinimum > 0) {
        recommendationSource = "LOW_STOCK";
        recommendedQuantity = lowStockMinimum;
        rationale = `Raise sellable stock above the reorder level of ${product.reorderLevel}.`;
      }
    }

    return {
      forecast: forecast
        ? {
            batchId: activeForecast?.id ?? null,
            currentMonthDemand: forecast.currentMonthForecastQuantity,
            modelName: forecast.modelName
          }
        : null,
      incomingStock,
      physicalOnHand: stockTruth.physicalOnHand,
      product: {
        barcode: product.barcode,
        id: product.id,
        name: product.name,
        reorderLevel: product.reorderLevel,
        sku: product.sku,
        targetStockLevel: product.targetStockLevel
      },
      quarantinedStock: stockTruth.quarantinedStock,
      rationale,
      recommendationId,
      recommendationSource,
      recommendedQuantity,
      sellableStock: stockTruth.sellableStock
    };
  });
  const filtered = query.includeZero
    ? candidates
    : candidates.filter((candidate) => candidate.recommendedQuantity > 0);
  const totalItems = filtered.length;
  const start = (query.page - 1) * query.pageSize;

  return {
    items: filtered.slice(start, start + query.pageSize),
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}

export async function dismissRestockRecommendation(
  recommendationId: string,
  input: DismissRestockRecommendationRequest,
  actorId: string
) {
  return await prisma.$transaction(async (tx) => {
    const recommendation = await tx.recommendationRecord.findUnique({
      select: {
        id: true,
        productId: true,
        status: true,
        type: true
      },
      where: { id: recommendationId }
    });

    if (!recommendation) {
      throw new HttpError(404, "Restock recommendation was not found.", {
        code: "RESTOCK_RECOMMENDATION_NOT_FOUND"
      });
    }
    if (!["RESTOCK", "LOW_STOCK"].includes(recommendation.type)) {
      throw new HttpError(422, "This recommendation is not a restock recommendation.", {
        code: "RESTOCK_RECOMMENDATION_INELIGIBLE"
      });
    }
    if (recommendation.status === "RESOLVED" || recommendation.status === "DISMISSED") {
      throw new HttpError(409, "The recommendation is already closed.", {
        code: "RESTOCK_RECOMMENDATION_ALREADY_CLOSED"
      });
    }

    const resolvedAt = new Date();
    await tx.recommendationRecord.update({
      data: {
        resolvedAt,
        status: "DISMISSED"
      },
      where: { id: recommendation.id }
    });
    await tx.catalogAuditLog.create({
      data: {
        action: "RESTOCK_RECOMMENDATION_DISMISSED",
        actor: actorId,
        automated: false,
        canonicalProductId: recommendation.productId,
        entityId: recommendation.id,
        entityType: "RECOMMENDATION",
        evidence: {
          previousStatus: recommendation.status,
          type: recommendation.type
        },
        reason: input.reason
      }
    });

    return {
      id: recommendation.id,
      resolvedAt: resolvedAt.toISOString(),
      status: "DISMISSED" as const
    };
  });
}
