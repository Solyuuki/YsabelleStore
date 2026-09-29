import { Prisma, type UserRole } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { getForecastDerivedMonthPlan } from "./forecastTargetService.js";

const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SALES_BUCKET_HOURS = 2;
const SALES_BUCKET_MS = SALES_BUCKET_HOURS * 60 * 60 * 1000;
const SALES_BUCKET_COUNT = 24 / SALES_BUCKET_HOURS;
export const SALES_CALENDAR_MIN_MONTH = "2019-01";
const SALES_CALENDAR_MIN_DATE = `${SALES_CALENDAR_MIN_MONTH}-01`;

export type SalesCalendarDayStatus = "PAST" | "TODAY" | "FUTURE";

export type DashboardSalesCalendarDay = {
  actualAmount: string;
  actualDataAvailable: boolean;
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
    actualDataDays: number;
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
  role: UserRole,
  now = new Date()
): Promise<DashboardSalesCalendar> {
  const { end, start } = getManilaMonthRange(month);
  const actualEnd = new Date(Math.min(end.getTime(), now.getTime() + 1));
  const [sales, targets, forecastPlan, firstCompletedSale] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        saleDate: { gte: start, lt: actualEnd }
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
    getForecastDerivedMonthPlan(month, now),
    prisma.sale.findFirst({
      orderBy: { saleDate: "asc" },
      select: { saleDate: true },
      where: {
        saleDate: { lte: now },
        status: "COMPLETED"
      }
    })
  ]);

  const todayKey = manilaDateKey(now);
  const firstRecordedDate = firstCompletedSale ? manilaDateKey(firstCompletedSale.saleDate) : null;
  const salesByDate = aggregateSalesByDate(sales);
  const targetsByDate = new Map(
    targets.map((target) => [utcDateKey(target.businessDate), target.targetAmount.toFixed(2)])
  );
  const days = monthDateKeys(month).map((date): DashboardSalesCalendarDay => {
    const aggregate = salesByDate.get(date);
    const persistedTarget = targetsByDate.get(date) ?? null;
    const generatedTarget = forecastPlan?.targets.get(date) ?? null;

    const status: SalesCalendarDayStatus =
      date < todayKey ? "PAST" : date === todayKey ? "TODAY" : "FUTURE";
    const target =
      status === "FUTURE"
        ? (generatedTarget ?? persistedTarget)
        : (persistedTarget ?? generatedTarget);
    const actualDataAvailable =
      status === "TODAY" ||
      (status === "PAST" && firstRecordedDate !== null && date >= firstRecordedDate);

    return {
      actualAmount: aggregate?.amount.toFixed(2) ?? "0.00",
      actualDataAvailable,
      completedSales: aggregate?.sales ?? 0,
      date,
      status,
      targetAmount: target,
      unitsSold: aggregate?.units ?? 0
    };
  });

  const actualAmount = days.reduce((sum, day) => sum.add(day.actualAmount), new Prisma.Decimal(0));
  const targetDays = days.filter((day) => day.targetAmount !== null);
  const targetAmount =
    targetDays.length > 0
      ? targetDays
          .reduce((sum, day) => sum.add(day.targetAmount ?? 0), new Prisma.Decimal(0))
          .toFixed(2)
      : null;

  return {
    days,
    generatedAt: now.toISOString(),
    month,
    summary: {
      actualAmount: actualAmount.toFixed(2),
      actualDataDays: days.filter((day) => day.actualDataAvailable).length,
      completedSales: days.reduce((sum, day) => sum + day.completedSales, 0),
      forecastAmount: role === "OWNER" ? (forecastPlan?.forecastAmount ?? null) : null,
      forecastUnits: role === "OWNER" ? (forecastPlan?.forecastUnits ?? null) : null,
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
  const actualEnd = new Date(Math.min(end.getTime(), now.getTime() + 1));
  const [sales, target, firstCompletedSale, forecastPlan] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        saleDate: { gte: start, lt: actualEnd }
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
    }),
    prisma.sale.findFirst({
      orderBy: { saleDate: "asc" },
      select: { saleDate: true },
      where: {
        saleDate: { lte: now },
        status: "COMPLETED"
      }
    }),
    getForecastDerivedMonthPlan(date.slice(0, 7), now)
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
  const status: SalesCalendarDayStatus =
    date < todayKey ? "PAST" : date === todayKey ? "TODAY" : "FUTURE";
  const firstRecordedDate = firstCompletedSale ? manilaDateKey(firstCompletedSale.saleDate) : null;
  const actualDataAvailable =
    status === "TODAY" ||
    (status === "PAST" && firstRecordedDate !== null && date >= firstRecordedDate);
  const persistedTarget = target?.targetAmount.toFixed(2) ?? null;
  const generatedTarget = forecastPlan?.targets.get(date) ?? null;
  const resolvedTarget =
    status === "FUTURE"
      ? (generatedTarget ?? persistedTarget)
      : (persistedTarget ?? generatedTarget);

  return {
    actualAmount: amount.toFixed(2),
    actualDataAvailable,
    activity: activityTotals.map((total, index) => ({
      label: formatBucketLabel(index),
      saleCount: activityCounts[index] ?? 0,
      totalAmount: total.toFixed(2)
    })),
    completedSales: sales.length,
    date,
    status,
    targetAmount: resolvedTarget,
    unitsSold: sales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    )
  };
}

function aggregateSalesByDate(sales: SaleRow[]) {
  const result = new Map<string, { amount: Prisma.Decimal; sales: number; units: number }>();

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

function getManilaMonthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new HttpError(400, "Sales calendar month is invalid.", {
      code: "INVALID_SALES_CALENDAR_MONTH"
    });
  }
  if (month < SALES_CALENDAR_MIN_MONTH) {
    throw new HttpError(400, "Sales calendar starts in January 2019.", {
      code: "SALES_CALENDAR_BEFORE_STORE_OPENING"
    });
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year!, monthNumber! - 1, 1) - MANILA_UTC_OFFSET_MS);
  const end = new Date(Date.UTC(year!, monthNumber!, 1) - MANILA_UTC_OFFSET_MS);
  return { end, start };
}

function monthDateKeys(month: string) {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from(
    { length: days },
    (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`
  );
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
  if (date < SALES_CALENDAR_MIN_DATE) {
    throw new HttpError(400, "Sales calendar starts in January 2019.", {
      code: "SALES_CALENDAR_BEFORE_STORE_OPENING"
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
