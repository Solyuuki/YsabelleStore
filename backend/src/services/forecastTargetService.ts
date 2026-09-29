import { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import type { ProductForecastDetail } from "../modules/forecasting/forecast.types.js";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const HISTORY_DAYS = 90;
const MIN_WEIGHTED_HISTORY_DAYS = 28;

let lastSynchronizedBatchId: string | null = null;
let synchronizationPromise: Promise<void> | null = null;

type DailyWeightProfile = {
  mode: "HISTORICAL_WEEKDAY" | "UNIFORM";
  weights: number[];
};

export async function ensureForecastDerivedSalesTargets(now = new Date()) {
  const active = await prisma.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    select: { id: true },
    where: { isActive: true, status: "READY" }
  });
  if (!active || active.id === lastSynchronizedBatchId) return;

  if (synchronizationPromise) {
    await synchronizationPromise;
    if (active.id === lastSynchronizedBatchId) return;
  }

  const activePromise = synchronizeBatchTargets(active.id, now);
  synchronizationPromise = activePromise;
  try {
    await activePromise;
    lastSynchronizedBatchId = active.id;
  } finally {
    if (synchronizationPromise === activePromise) synchronizationPromise = null;
  }
}

async function synchronizeBatchTargets(batchId: string, now: Date) {
  const rows = await prisma.forecastProductResult.findMany({
    select: { detailPayload: true },
    where: { batchId }
  });
  if (rows.length === 0) return;

  const monthlyRevenue = new Map<string, number>();
  for (const row of rows) {
    const detail = row.detailPayload as unknown as ProductForecastDetail;
    for (const point of detail.forecast) {
      const revenue = Math.max(0, point.predictedQuantity) * Math.max(0, detail.sellingPrice);
      monthlyRevenue.set(point.period, (monthlyRevenue.get(point.period) ?? 0) + revenue);
    }
  }
  if (monthlyRevenue.size === 0) return;

  const weightProfile = await loadDailyWeightProfile(now);
  const today = manilaDateKey(now);
  const months = [...monthlyRevenue.keys()].sort();
  const firstMonth = months[0];
  if (!firstMonth) return;

  const targetRows = months.flatMap((month) =>
    allocateMonth(month, monthlyRevenue.get(month) ?? 0, weightProfile.weights).map((target) => ({
      ...target,
      shouldFreeze: target.date < today
    }))
  );

  const existing = await prisma.dailySalesTarget.findMany({
    select: { businessDate: true, id: true, targetAmount: true },
    where: {
      businessDate: {
        gte: businessDateValue(targetRows[0]!.date),
        lte: businessDateValue(targetRows.at(-1)!.date)
      }
    }
  });
  const existingByDate = new Map(existing.map((row) => [utcDateKey(row.businessDate), row]));

  await prisma.$transaction(
    targetRows.flatMap((target) => {
      const current = existingByDate.get(target.date);
      const amount = new Prisma.Decimal(target.amount.toFixed(2));

      if (current && target.shouldFreeze) {
        return [];
      }
      if (current) {
        return [
          prisma.dailySalesTarget.update({
            data: {
              targetAmount: amount,
              updatedById: null
            },
            where: { id: current.id }
          })
        ];
      }

      return [
        prisma.dailySalesTarget.create({
          data: {
            businessDate: businessDateValue(target.date),
            createdById: null,
            targetAmount: amount,
            updatedById: null
          }
        })
      ];
    })
  );

  void weightProfile.mode;
}

async function loadDailyWeightProfile(now: Date): Promise<DailyWeightProfile> {
  const end = manilaDayStart(manilaDateKey(now));
  const start = new Date(end.getTime() - HISTORY_DAYS * DAY_MS);
  const firstSale = await prisma.sale.findFirst({
    orderBy: { saleDate: "asc" },
    select: { saleDate: true },
    where: { status: "COMPLETED", saleDate: { lt: end } }
  });

  if (!firstSale) return uniformProfile();

  const coverageStart = new Date(Math.max(start.getTime(), manilaDayStart(manilaDateKey(firstSale.saleDate)).getTime()));
  const coverageDays = Math.max(0, Math.floor((end.getTime() - coverageStart.getTime()) / DAY_MS));
  if (coverageDays < MIN_WEIGHTED_HISTORY_DAYS) return uniformProfile();

  const sales = await prisma.sale.findMany({
    select: { saleDate: true, totalAmount: true },
    where: {
      status: "COMPLETED",
      saleDate: { gte: coverageStart, lt: end }
    }
  });
  const revenueByDate = new Map<string, number>();
  for (const sale of sales) {
    const key = manilaDateKey(sale.saleDate);
    revenueByDate.set(key, (revenueByDate.get(key) ?? 0) + Number(sale.totalAmount));
  }

  const weekdayTotals = Array.from({ length: 7 }, () => 0);
  const weekdayCounts = Array.from({ length: 7 }, () => 0);
  for (let cursor = new Date(coverageStart); cursor < end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const key = manilaDateKey(cursor);
    const weekday = new Date(`${key}T00:00:00.000Z`).getUTCDay();
    weekdayTotals[weekday] = (weekdayTotals[weekday] ?? 0) + (revenueByDate.get(key) ?? 0);
    weekdayCounts[weekday] = (weekdayCounts[weekday] ?? 0) + 1;
  }

  const averages = weekdayTotals.map((total, index) =>
    weekdayCounts[index] ? total / weekdayCounts[index]! : 0
  );
  const positiveTotal = averages.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (positiveTotal <= 0) return uniformProfile();

  return {
    mode: "HISTORICAL_WEEKDAY",
    weights: averages.map((value) => Math.max(0, value) / positiveTotal)
  };
}

function uniformProfile(): DailyWeightProfile {
  return { mode: "UNIFORM", weights: Array.from({ length: 7 }, () => 1 / 7) };
}

function allocateMonth(month: string, amount: number, weekdayWeights: number[]) {
  const dates = monthDateKeys(month);
  const rawWeights = dates.map((date) => {
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    return Math.max(0, weekdayWeights[weekday] ?? 0);
  });
  const totalWeight = rawWeights.reduce((sum, value) => sum + value, 0);
  const normalized =
    totalWeight > 0 ? rawWeights.map((value) => value / totalWeight) : dates.map(() => 1 / dates.length);
  const totalCents = Math.max(0, Math.round(amount * 100));
  const rawCents = normalized.map((weight) => totalCents * weight);
  const cents = rawCents.map((value) => Math.floor(value));
  let remainder = totalCents - cents.reduce((sum, value) => sum + value, 0);

  const remainderOrder = rawCents
    .map((value, index) => ({ fraction: value - Math.floor(value), index }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; remainder > 0 && index < remainderOrder.length; index += 1, remainder -= 1) {
    cents[remainderOrder[index]!.index] = (cents[remainderOrder[index]!.index] ?? 0) + 1;
  }

  return dates.map((date, index) => ({ amount: (cents[index] ?? 0) / 100, date }));
}

function monthDateKeys(month: string) {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from(
    { length: days },
    (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`
  );
}

function businessDateValue(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function manilaDayStart(date: string) {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - MANILA_OFFSET_MS);
}

function manilaDateKey(date: Date) {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}
