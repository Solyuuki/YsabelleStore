import type { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import type { ProductForecastDetail } from "../modules/forecasting/forecast.types.js";

export type ActiveInventoryForecast = {
  batchId: string;
  forecastMonth: string;
  generatedAt: string | null;
  historical: Array<{ period: string; quantitySold: number }>;
  modelName: string | null;
  points: Array<{
    lowerConfidence: number | null;
    period: string;
    predictedQuantity: number;
    upperConfidence: number | null;
  }>;
};

export async function loadActiveInventoryForecasts(
  productIds: string[],
  db: Prisma.TransactionClient = prisma
) {
  const uniqueProductIds = [...new Set(productIds)];
  const forecasts = new Map<string, ActiveInventoryForecast>();
  if (uniqueProductIds.length === 0) return forecasts;

  const batch = await db.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    select: {
      forecastStartMonth: true,
      generatedAt: true,
      id: true
    },
    where: { isActive: true, status: "READY" }
  });
  if (!batch) return forecasts;

  const rows = await db.forecastProductResult.findMany({
    select: {
      detailPayload: true,
      sourceProductId: true
    },
    where: {
      batchId: batch.id,
      sourceProductId: { in: uniqueProductIds }
    }
  });
  const forecastMonth = batch.forecastStartMonth.toISOString().slice(0, 7);

  for (const row of rows) {
    const detail = row.detailPayload as unknown as ProductForecastDetail;
    const points = detail.forecast
      .filter((point) => point.period >= forecastMonth)
      .map((point) => ({
        lowerConfidence: point.lowerConfidence,
        period: point.period,
        predictedQuantity: point.predictedQuantity,
        upperConfidence: point.upperConfidence
      }));
    if (points.length === 0) continue;

    forecasts.set(row.sourceProductId, {
      batchId: batch.id,
      forecastMonth,
      generatedAt: batch.generatedAt?.toISOString() ?? detail.generatedAt ?? null,
      historical: detail.historical.map((point) => ({
        period: point.period,
        quantitySold: point.quantitySold
      })),
      modelName: detail.model,
      points
    });
  }

  return forecasts;
}
