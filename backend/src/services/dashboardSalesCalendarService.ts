import { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import type { ProductForecastDetail } from "../modules/forecasting/forecast.types.js";
import { HttpError } from "../utils/httpError.js";

const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SALES_BUCKET_HOURS = 2;
const SALES_BUCKET_MS = SALES_BUCKET_HOURS * 60 * 60 * 1000;
const SALES_BUCKET_COUNT = 24 / SALES_BUCKET_HOURS;

export type SalesCalendarDayStatus = "PAST" | "TODAY" | "FUTURE";

export type DashboardSalesCalendarDay = {
  actualAmount: string;
  completedSales: number;
  date: string;
  status: SalesCalendarDayStatus;
  targetAmount: string | null;
  unitsSold: number;
};

export type DashboardSalesActivityBucket = {
  label: string;
  saleCount: number;
  totalAmount: string;
};

export type DashboardSalesDayDetail = DashboardSalesCalendarDay & {
  activity: DashboardSalesActivityBucket[];
};

export type DashboardSalesCalendar = {
  days: DashboardSalesCalendarDay[];
  generatedAt: string;
  month: string;
  summary: {
    actualAmount: string;
    completedSales: number;
    forecastAmount: string | null;
    forecastUnits: number | null;
    targetAmount: string | null;
    targetDays: number;
    unitsSold: number;
  };
  timeZone: "Asia/Manila";
};

type SaleRow = {
  items: { quantity: number }[];
  saleDate: Date;
  totalAmount: Prisma.Decimal;
};

export async function getDashboardSalesCalendar(
  month: string,
  now = new Date()
): Promise<DashboardSalesCalendar> {
  const { end, start } = getManilaMonthRange(month);
  const [sales, targets, forecast] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        saleDate: { gte: start, lt: end }
      },
      select: {
        items: { select: { quantity: true } },
        saleDate: true,
        totalAmount: true
      }
    }),
    prisma.dailySalesTarget.findMany({
      where: {
        businessDate: {
          gte: businessDateValue(`${month}-01`),
          lt: businessDateValue(nextMonthDateKey(month))
        }
      },
      select: {
        businessDate: true,
        targetAmount: true
      }
    }),
    getMonthlyForecastEstimate(month)
  ]);

  const todayKey = manilaDateKey(now);
  const salesByDate = aggregateSalesByDate(sales);
  const targetsByDate = new Map(
    targets.map((target) => [utcDateKey(target.businessDate), target.targetAmount])
  );
  const days = monthDateKeys(month).map((date): DashboardSalesCalendarDay => {
    const aggregate = salesByDate.get(date);
    const target = targetsByDate.get(date);

    return {
      actualAmount: aggregate?.amount.toFixed(2) ?? "0.00",
      completedSales: aggregate?.sales ?? 0,
      date,
      status: date < todayKey ? "PAST" : date === todayKey ? "TODAY" : "FUTURE",
      targetAmount: target?.toFixed(2) ?? null,
      unitsSold: aggregate?.units ?? 0
    };
  });

  const actualAmount = days.reduce(
    (sum, day) => sum.add(day.actualAmount),
    new Prisma.Decimal(0)
  );
  const targetDays = days.filter((day) => day.targetAmount !== null);
  const targetAmount =
    targetDays.length > 0
      ? targetDays.reduce(
          (sum, day) => sum.add(day.targetAmount ?? 0),
          new Prisma.Decimal(0)
        ).toFixed(2)
      : null;

  return {
    days,
    generatedAt: now.toISOString(),
    month,
    summary: {
      actualAmount: actualAmount.toFixed(2),
      completedSales: days.reduce((sum, day) => sum + day.completedSales, 0),
      forecastAmount: forecast?.amount ?? null,
      forecastUnits: forecast?.units ?? null,
      targetAmount,
      targetDays: targetDays.length,
      unitsSold: days.reduce((sum, day) => sum + day.unitsSold, 0)
    },
    timeZone: "Asia/Manila"
  };
}

export async function getDashboardSalesDay(
  date: string,
  now = new Date()
): Promise<DashboardSalesDayDetail> {
  assertValidDateKey(date);
  const start = manilaDayStart(date);
  const end = new Date(start.getTime() + DAY_MS);
  const [sales, target] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        saleDate: { gte: start, lt: end }
      },
      select: {
        items: { select: { quantity: true } },
        saleDate: true,
        totalAmount: true
      }
    }),
    prisma.dailySalesTarget.findUnique({
      where: { businessDate: businessDateValue(date) },
      select: { targetAmount: true }
    })
  ]);

  const amount = sales.reduce((sum, sale) => sum.add(sale.totalAmount), new Prisma.Decimal(0));
  const activityTotals = Array.from({ length: SALES_BUCKET_COUNT }, () => new Prisma.Decimal(0));
  const activityCounts = Array.from({ length: SALES_BUCKET_COUNT }, () => 0);

  for (const sale of sales) {
    const bucketIndex = Math.min(
      SALES_BUCKET_COUNT - 1,
      Math.max(0, Math.floor((sale.saleDate.getTime() - start.getTime()) / SALES_BUCKET_MS))
    );
    activityTotals[bucketIndex] = activityTotals[bucketIndex]!.add(sale.totalAmount);
    activityCounts[bucketIndex] = (activityCounts[bucketIndex] ?? 0) + 1;
  }

  const todayKey = manilaDateKey(now);

  return {
    actualAmount: amount.toFixed(2),
    activity: activityTotals.map((total, index) => ({
      label: formatBucketLabel(index),
      saleCount: activityCounts[index] ?? 0,
      totalAmount: total.toFixed(2)
    })),
    completedSales: sales.length,
    date,
    status: date < todayKey ? "PAST" : date === todayKey ? "TODAY" : "FUTURE",
    targetAmount: target?.targetAmount.toFixed(2) ?? null,
    unitsSold: sales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    )
  };
}

export async function setDashboardSalesTarget(
  date: string,
  targetAmount: number | null,
  userId: string
) {
  assertValidDateKey(date);
  const businessDate = businessDateValue(date);

  if (targetAmount === null) {
    await prisma.dailySalesTarget.deleteMany({ where: { businessDate } });
    return { date, targetAmount: null };
  }

  const target = await prisma.dailySalesTarget.upsert({
    create: {
      businessDate,
      createdById: userId,
      targetAmount: new Prisma.Decimal(targetAmount),
      updatedById: userId
    },
    update: {
      targetAmount: new Prisma.Decimal(targetAmount),
      updatedById: userId
    },
    where: { businessDate }
  });

  return { date, targetAmount: target.targetAmount.toFixed(2) };
}

function aggregateSalesByDate(sales: SaleRow[]) {
  const result = new Map<
    string,
    { amount: Prisma.Decimal; sales: number; units: number }
  >();

  for (const sale of sales) {
    const date = manilaDateKey(sale.saleDate);
    const current = result.get(date) ?? {
      amount: new Prisma.Decimal(0),
      sales: 0,
      units: 0
    };
    current.amount = current.amount.add(sale.totalAmount);
    current.sales += 1;
    current.units += sale.items.reduce((sum, item) => sum + item.quantity, 0);
    result.set(date, current);
  }

  return result;
}

async function getMonthlyForecastEstimate(month: string) {
  const batch = await prisma.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    select: { id: true },
    where: { isActive: true, status: "READY" }
  });

  if (!batch) return null;

  const rows = await prisma.forecastProductResult.findMany({
    select: { detailPayload: true },
    where: { batchId: batch.id }
  });

  let units = 0;
  let amount = 0;
  let matched = false;

  for (const row of rows) {
    const detail = row.detailPayload as unknown as ProductForecastDetail;
    const point = detail.forecast.find((candidate) => candidate.period === month);
    if (!point) continue;
    matched = true;
    units += point.predictedQuantity;
    amount += point.predictedQuantity * detail.sellingPrice;
  }

  if (!matched) return null;

  return {
    amount: new Prisma.Decimal(amount).toFixed(2),
    units: Math.max(0, Math.round(units))
  };
}

function getManilaMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    throw new HttpError(400, "Sales calendar month is invalid.", {
      code: "INVALID_SALES_CALENDAR_MONTH"
    });
  }

  const start = new Date(Date.UTC(year, monthNumber - 1, 1) - MANILA_UTC_OFFSET_MS);
  const end = new Date(Date.UTC(year, monthNumber, 1) - MANILA_UTC_OFFSET_MS);
  return { end, start };
}

function monthDateKeys(month: string) {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function nextMonthDateKey(month: string) {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function businessDateValue(date: string) {
  assertValidDateKey(date);
  return new Date(`${date}T00:00:00.000Z`);
}

function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function manilaDayStart(date: string) {
  assertValidDateKey(date);
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - MANILA_UTC_OFFSET_MS);
}

function manilaDateKey(date: Date) {
  const shifted = new Date(date.getTime() + MANILA_UTC_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function assertValidDateKey(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new HttpError(400, "Sales calendar date is invalid.", {
      code: "INVALID_SALES_CALENDAR_DATE"
    });
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new HttpError(400, "Sales calendar date is invalid.", {
      code: "INVALID_SALES_CALENDAR_DATE"
    });
  }
}

function formatBucketLabel(index: number) {
  const startHour = index * SALES_BUCKET_HOURS;
  const endHour = (startHour + SALES_BUCKET_HOURS) % 24;
  return `${formatHour(startHour)}–${formatHour(endHour)}`;
}

function formatHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}
