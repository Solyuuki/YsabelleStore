import type { Prisma } from "@prisma/client";

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
import { loadActiveInventoryForecasts } from "./inventoryForecastSourceService.js";
import { buildRestockForecastDecision } from "./restockForecastDecisionService.js";
import { getIncomingRestockStock } from "./restockService.js";
import { activeReservationsByProduct } from "./stockReservationService.js";
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

export async function listRestockPlanningCandidates(
  query: RestockPlanningQuery,
  requestedProductIds?: readonly string[],
  excludeOrderId?: string,
  db: Prisma.TransactionClient = prisma
) {
  const products = await db.product.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    where: {
      dataQualityStatus: { not: "REJECTED" },
      recordSource: { not: "TEST_FIXTURE" },
      status: { not: "DISCONTINUED" },
      ...(requestedProductIds ? { id: { in: [...new Set(requestedProductIds)] } } : {}),
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
      costPrice: true,
      id: true,
      inventoryBatches: {
        select: {
          expiresAt: true,
          quantityRemaining: true,
          status: true,
          unitCost: true
        }
      },
      name: true,
      reorderLevel: true,
      sku: true,
      targetStockLevel: true,
      restockTargetApprovedLevel: true,
      restockTargetApprovedById: true,
      restockTargetApprovedAt: true
    }
  });
  const productIds = products.map((product) => product.id);
  const now = new Date();
  const [incomingByProduct, operationalSalesByProduct, activeForecasts, activeReservations] =
    await Promise.all([
      getIncomingRestockStock(productIds, excludeOrderId, db),
      loadOperationalPosSales(productIds, now, db),
      loadActiveInventoryForecasts(productIds, db),
      activeReservationsByProduct(db, productIds)
    ]);

  const recommendations = productIds.length
    ? await db.recommendationRecord.findMany({
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
    // Pending Storefront commitments are not completed sales. Their reserved
    // quantity reduces stock available for a NEW sale or replenishment plan.
    const reservedStock = activeReservations.get(product.id) ?? 0;
    const availableForNewOrders = Math.max(0, stockTruth.sellableStock - reservedStock);
    // Use the highest known unit cost so missing/stale catalog prices
    // cannot silently understate the estimated purchase commitment.
    const knownUnitCosts = [
      product.costPrice?.toNumber(),
      ...product.inventoryBatches.map((batch) => batch.unitCost?.toNumber())
    ].filter(
      (price): price is number => price !== undefined && Number.isFinite(price) && price > 0
    );
    const conservativeUnitCost = knownUnitCosts.length > 0 ? Math.max(...knownUnitCosts) : null;
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
      sellableStock: availableForNewOrders
    });
    const activeForecast = activeForecasts.get(product.id) ?? null;
    const operationalForecast = activeForecast
      ? null
      : buildOperationalRestockForecast({
          expiryRiskQuantity,
          historicalSeries: salesSeries,
          incomingStock,
          now,
          reorderLevel: product.reorderLevel,
          sellableStock: availableForNewOrders,
          targetStockLevel: product.targetStockLevel
        });
    const forecastDecision = activeForecast
      ? buildRestockForecastDecision({
          expiryRiskQuantity,
          forecast: activeForecast.points,
          incomingStock,
          now,
          reorderLevel: product.reorderLevel,
          sellableStock: availableForNewOrders,
          targetStockLevel: product.targetStockLevel
        })
      : {
          confidenceAdjustedDemand: operationalForecast!.confidenceAdjustedDemand,
          currentMonthDemand: operationalForecast!.expected30d,
          projectedEndingStock: operationalForecast!.projectedEndingStock,
          projectedStockoutDate: operationalForecast!.projectedStockoutDate,
          reason: operationalForecast!.reason,
          recommendedActionDate: operationalForecast!.recommendedActionDate,
          riskLevel: operationalForecast!.riskLevel,
          suggestedQuantity: operationalForecast!.suggestedQuantity
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
    let recommendationSource: "SARIMA" | "LOW_STOCK" | "TARGET_STOCK" = activeForecast
      ? "SARIMA"
      : "TARGET_STOCK";
    let recommendedQuantity = forecastDecision.suggestedQuantity;
    let rationale = forecastDecision.reason;

    if (recommendedQuantity > 0) {
      const demandDrivenLowStock =
        stockHealth.status === "OUT_OF_STOCK" ||
        stockHealth.status === "LOW_STOCK" ||
        (forecastDecision.currentMonthDemand > 0 && forecastDecision.projectedEndingStock < 0);
      recommendationSource = activeForecast
        ? "SARIMA"
        : demandDrivenLowStock
          ? "LOW_STOCK"
          : "TARGET_STOCK";
      if (
        persistedOperationalRecommendation &&
        ((recommendationSource === "LOW_STOCK" &&
          persistedOperationalRecommendation.type === "LOW_STOCK") ||
          ((recommendationSource === "TARGET_STOCK" || recommendationSource === "SARIMA") &&
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
      forecast: activeForecast
        ? {
            batchId: activeForecast.batchId,
            currentMonthDemand: forecastDecision.currentMonthDemand,
            generatedAt: activeForecast.generatedAt,
            historical: activeForecast.historical,
            modelName: activeForecast.modelName,
            points: activeForecast.points
          }
        : {
            batchId: null,
            currentMonthDemand: operationalForecast!.expected30d,
            generatedAt: now.toISOString(),
            historical: operationalForecast!.historical,
            modelName: "RESTOCK_POS_FALLBACK",
            points: operationalForecast!.points
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
        targetStockLevel: product.targetStockLevel,
        approvedTargetStockLevel: product.restockTargetApprovedLevel,
        targetApprovalById: product.restockTargetApprovedById,
        targetApprovedAt: product.restockTargetApprovedAt,
        unitCost: conservativeUnitCost
      },
      quarantinedStock: stockTruth.quarantinedStock,
      rationale,
      recommendationId,
      recommendationSource,
      recommendedQuantity,
      sellableStock: availableForNewOrders,
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
