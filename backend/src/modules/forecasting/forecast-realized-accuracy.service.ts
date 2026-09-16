import { prisma } from "../../database/prismaClient.js";
import type { ProductForecastDetail } from "./forecast.types.js";

function round4(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function applyRealizedAccuracyFeedback(
  detail: ProductForecastDetail,
  previous: ProductForecastDetail | null
): ProductForecastDetail {
  const latestActual = detail.historical.at(-1);
  if (!latestActual || !previous) return detail;

  const realizedMonth = latestActual.period.slice(0, 7);
  const previousForecast = previous.forecast.find(
    (point) => point.period.slice(0, 7) === realizedMonth
  );
  if (!previousForecast || !Number.isFinite(previousForecast.predictedQuantity)) return detail;

  const actualQuantity = latestActual.quantitySold;
  const predictedQuantity = previousForecast.predictedQuantity;
  const signedError = predictedQuantity - actualQuantity;

  return {
    ...detail,
    accuracyFeedback: {
      absoluteError: round4(Math.abs(signedError)),
      absolutePercentageError:
        actualQuantity === 0 ? null : round4((Math.abs(signedError) / actualQuantity) * 100),
      actualQuantity: round4(actualQuantity),
      evaluatedPeriod: `${realizedMonth}-01`,
      predictedQuantity: round4(Math.max(0, predictedQuantity)),
      signedError: round4(signedError),
      strategy:
        "Realized forecast-vs-actual feedback using the forecast issued before this completed month became actual."
    }
  };
}

async function currentBatch(batchId?: string) {
  if (batchId) {
    return await prisma.forecastBatchCache.findUnique({
      select: { createdAt: true, id: true },
      where: { id: batchId }
    });
  }

  return await prisma.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    select: { createdAt: true, id: true },
    where: { isActive: true, status: "READY" }
  });
}

async function previousDetail(productId: string, batchId?: string) {
  const current = await currentBatch(batchId);
  if (!current) return null;

  const previousBatch = await prisma.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    select: { id: true },
    where: {
      createdAt: { lt: current.createdAt },
      status: "SUPERSEDED"
    }
  });
  if (!previousBatch) return null;

  const row = await prisma.forecastProductResult.findUnique({
    select: { detailPayload: true },
    where: {
      batchId_sourceProductId: {
        batchId: previousBatch.id,
        sourceProductId: productId
      }
    }
  });

  return row?.detailPayload
    ? (row.detailPayload as unknown as ProductForecastDetail)
    : null;
}

export async function withRealizedAccuracyFeedback(
  detail: ProductForecastDetail | null,
  batchId?: string
): Promise<ProductForecastDetail | null> {
  if (!detail) return detail;

  try {
    const previous = await previousDetail(detail.productId, batchId);
    return applyRealizedAccuracyFeedback(detail, previous);
  } catch (error) {
    console.warn(
      "[forecast] Realized accuracy feedback unavailable; serving forecast without it.",
      error
    );
    return detail;
  }
}
