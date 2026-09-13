import { prisma } from "../database/prismaClient.js";
import { getEffectiveMonthlySeries } from "../modules/forecasting/effective-sales.service.js";
import { HttpError } from "../utils/httpError.js";
import { buildPaginationMeta } from "../utils/pagination.js";
import type {
  DismissRestockRecommendationRequest,
  RestockPlanningQuery
} from "../validators/restock.validators.js";
import { buildRestockForecastDecision } from "./restockForecastDecisionService.js";
import { getIncomingRestockStock } from "./restockService.js";
import { classifyStockHealth } from "./stockHealthService.js";
import {
  calculateStockTruth,
  getDaysUntilExpiry,
  isBatchSellable,
  NEAR_EXPIRY_WINDOW_DAYS
} from "./stockTruth.js";

type PersistedForecastPoint = {
  period: string;
  predictedQuantity: number;
  lowerConfidence: number | null;
  upperConfidence: number | null;
};

type PersistedHistoricalPoint = {
  period: string;
  quantitySold: number;
};

type PersistedForecastDetail = {
  generatedAt?: string;
  forecast?: PersistedForecastPoint[];
  historical?: PersistedHistoricalPoint[];
};

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
  const [incomingByProduct, effectiveSales] = await Promise.all([
    getIncomingRestockStock(productIds),
    productIds.length ? getEffectiveMonthlySeries(productIds) : Promise.resolve([])
  ]);
  const effectiveSalesByProduct = new Map(
    effectiveSales.map((series) => [series.productId, series.points])
  );

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
      generatedAt: true,
      id: true,
      source: true,
      products: {
        select: {
          currentMonthForecastQuantity: true,
          detailPayload: true,
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
    {
      currentMonthForecastQuantity: number | null;
      forecast: PersistedForecastPoint[];
      generatedAt: string | null;
      historical: PersistedHistoricalPoint[];
      modelName: string | null;
    }
  >();

  for (const forecastProduct of activeForecast?.products ?? []) {
    const canonicalProductId =
      activeForecast?.source === "DATABASE"
        ? forecastProduct.sourceProductId
        : workbookCanonicalBySource.get(forecastProduct.sourceProductId);
    if (!canonicalProductId) continue;

    const detail = forecastProduct.detailPayload as unknown as PersistedForecastDetail;
    const forecast = Array.isArray(detail.forecast)
      ? detail.forecast.filter(
          (point): point is PersistedForecastPoint =>
            Boolean(point) &&
            typeof point.period === "string" &&
            Number.isFinite(point.predictedQuantity)
        )
      : [];
    const historical = Array.isArray(detail.historical)
      ? detail.historical.filter(
          (point): point is PersistedHistoricalPoint =>
            Boolean(point) && typeof point.period === "string" && Number.isFinite(point.quantitySold)
        )
      : [];

    forecastByCanonicalProduct.set(canonicalProductId, {
      currentMonthForecastQuantity:
        forecastProduct.currentMonthForecastQuantity === null
          ? null
          : Number(forecastProduct.currentMonthForecastQuantity),
      forecast,
      generatedAt: detail.generatedAt ?? activeForecast?.generatedAt?.toISOString() ?? null,
      historical,
      modelName: forecastProduct.modelName
    });
  }

  const now = new Date();
  const candidates = products.map((product) => {
    const stockTruth = calculateStockTruth(product.inventoryBatches, now);
    const incomingStock = incomingByProduct.get(product.id) ?? 0;
    const recommendation = latestRecommendation.get(product.id);
    const forecast = forecastByCanonicalProduct.get(product.id) ?? null;
    const expiryRiskQuantity = product.inventoryBatches.reduce((sum, batch) => {
      const daysUntilExpiry = getDaysUntilExpiry(batch.expiresAt, now);
      const exposed =
        isBatchSellable(batch, now) &&
        daysUntilExpiry !== null &&
        daysUntilExpiry <= NEAR_EXPIRY_WINDOW_DAYS;
      return exposed ? sum + Math.max(0, batch.quantityRemaining) : sum;
    }, 0);
    const forecastDecision = forecast
      ? buildRestockForecastDecision({
          expiryRiskQuantity,
          forecast: forecast.forecast,
          incomingStock,
          now,
          reorderLevel: product.reorderLevel,
          sellableStock: stockTruth.sellableStock,
          targetStockLevel: product.targetStockLevel
        })
      : null;
    const stockHealth = classifyStockHealth({
      asOf: now,
      forecastMonthlyDemand:
        forecast?.currentMonthForecastQuantity ?? forecastDecision?.currentMonthDemand ?? null,
      historicalSeries: (effectiveSalesByProduct.get(product.id) ?? []).map((point) => ({
        period: point.period,
        quantitySold: point.quantitySold
      })),
      sellableStock: stockTruth.sellableStock
    });
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
    } else if (forecastDecision && forecastDecision.suggestedQuantity > 0) {
      recommendationSource = "SARIMA";
      recommendedQuantity = forecastDecision.suggestedQuantity;
      rationale = forecastDecision.reason;
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
      expiryRiskQuantity,
      forecast: forecast
        ? {
            batchId: activeForecast?.id ?? null,
            currentMonthDemand: forecast.currentMonthForecastQuantity,
            generatedAt: forecast.generatedAt,
            historical: forecast.historical,
            modelName: forecast.modelName,
            points: forecast.forecast
          }
        : null,
      forecastDecision,
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
      sellableStock: stockTruth.sellableStock,
      stockHealth
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
