import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { buildPaginationMeta } from "../utils/pagination.js";
import type {
  DismissRestockRecommendationRequest,
  RestockPlanningQuery
} from "../validators/restock.validators.js";
import {
  buildOperationalRestockForecast,
  loadOperationalPosSales
} from "./restockDemandForecastService.js";
import { getIncomingRestockStock } from "./restockService.js";
import { classifyStockHealth } from "./stockHealthService.js";
import {
  calculateStockTruth,
  getDaysUntilExpiry,
  isBatchSellable,
  NEAR_EXPIRY_WINDOW_DAYS
} from "./stockTruth.js";

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
  const now = new Date();
  const [incomingByProduct, operationalSalesByProduct] = await Promise.all([
    getIncomingRestockStock(productIds),
    loadOperationalPosSales(productIds, now)
  ]);

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

  const candidates = products.map((product) => {
    const stockTruth = calculateStockTruth(product.inventoryBatches, now);
    const incomingStock = incomingByProduct.get(product.id) ?? 0;
    const salesSeries = operationalSalesByProduct.get(product.id) ?? [];
    const recommendation = latestRecommendation.get(product.id);
    const expiryRiskQuantity = product.inventoryBatches.reduce((sum, batch) => {
      const daysUntilExpiry = getDaysUntilExpiry(batch.expiresAt, now);
      const exposed =
        isBatchSellable(batch, now) &&
        daysUntilExpiry !== null &&
        daysUntilExpiry <= NEAR_EXPIRY_WINDOW_DAYS;
      return exposed ? sum + Math.max(0, batch.quantityRemaining) : sum;
    }, 0);
    const stockHealth = classifyStockHealth({
      asOf: now,
      historicalSeries: salesSeries,
      sellableStock: stockTruth.sellableStock
    });
    const operationalForecast = buildOperationalRestockForecast({
      expiryRiskQuantity,
      historicalSeries: salesSeries,
      incomingStock,
      now,
      reorderLevel: product.reorderLevel,
      sellableStock: stockTruth.sellableStock,
      targetStockLevel: product.targetStockLevel
    });
    const forecastDecision = {
      confidenceAdjustedDemand: operationalForecast.confidenceAdjustedDemand,
      currentMonthDemand: operationalForecast.expected30d,
      projectedEndingStock: operationalForecast.projectedEndingStock,
      projectedStockoutDate: operationalForecast.projectedStockoutDate,
      reason: operationalForecast.reason,
      recommendedActionDate: operationalForecast.recommendedActionDate,
      riskLevel: operationalForecast.riskLevel,
      suggestedQuantity: operationalForecast.suggestedQuantity
    };
    const persistedOperationalRecommendation = recommendation?.forecastRecordId
      ? null
      : recommendation;
    const persistedRecommendationQuantity =
      persistedOperationalRecommendation?.recommendedQuantity !== null &&
      persistedOperationalRecommendation?.recommendedQuantity !== undefined
        ? Math.max(0, persistedOperationalRecommendation.recommendedQuantity - incomingStock)
        : 0;

    let recommendationId: string | null = null;
    let recommendationSource: "SARIMA" | "LOW_STOCK" | "TARGET_STOCK" = "TARGET_STOCK";
    let recommendedQuantity = operationalForecast.suggestedQuantity;
    let rationale = operationalForecast.reason;

    if (recommendedQuantity > 0) {
      const demandDrivenLowStock =
        stockHealth.status === "OUT_OF_STOCK" ||
        stockHealth.status === "LOW_STOCK" ||
        (operationalForecast.expected30d > 0 && operationalForecast.projectedEndingStock < 0);
      recommendationSource = demandDrivenLowStock ? "LOW_STOCK" : "TARGET_STOCK";
      if (
        persistedOperationalRecommendation &&
        ((recommendationSource === "LOW_STOCK" && persistedOperationalRecommendation.type === "LOW_STOCK") ||
          (recommendationSource === "TARGET_STOCK" &&
            persistedOperationalRecommendation.type === "RESTOCK"))
      ) {
        recommendationId = persistedOperationalRecommendation.id;
      }
    } else if (persistedRecommendationQuantity > 0 && persistedOperationalRecommendation) {
      recommendationId = persistedOperationalRecommendation.id;
      recommendationSource =
        persistedOperationalRecommendation.type === "LOW_STOCK" ? "LOW_STOCK" : "TARGET_STOCK";
      recommendedQuantity = persistedRecommendationQuantity;
      rationale = persistedOperationalRecommendation.reason;
    }

    return {
      expiryRiskQuantity,
      forecast: {
        batchId: null,
        currentMonthDemand: operationalForecast.expected30d,
        generatedAt: now.toISOString(),
        historical: operationalForecast.historical,
        modelName: "RESTOCK_POS",
        points: operationalForecast.points
      },
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
