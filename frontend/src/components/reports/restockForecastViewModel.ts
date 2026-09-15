import {
  listRestockOrders,
  listRestockPlanning,
  type RestockForecastRisk,
  type RestockOrder,
  type RestockOrderStatus,
  type RestockPlanningCandidate
} from "@/services/restockApi";

export const RISK_PRIORITY: Record<RestockForecastRisk, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export const ACTIVE_RESTOCK_STATUSES = [
  "APPROVED",
  "AWAITING_DELIVERY",
  "PARTIALLY_RECEIVED"
] as const satisfies readonly RestockOrderStatus[];

export const WATCHLIST_FETCH_PAGE_SIZE = 100;
export const WATCHLIST_PAGE_SIZE = 10;

const MONTH_ABBREVIATIONS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC"
] as const;

export type ActiveProductRestock = {
  automated: boolean;
  latestCreatedAt: string;
  latestOrderNumber: string;
  latestStatus: RestockOrderStatus;
  latestUpdatedAt: string;
  monthly: boolean;
  ticketCount: number;
  totalRemaining: number;
};

export type NextMonthRestockPreview = {
  batchNumber: string;
  currentCycleQuantity: number;
  estimatedRestock: number;
  expectedDemand: number;
  monthLabel: string;
  monthShortLabel: string;
  projectedOpeningStock: number;
};

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 7);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC"
  }).format(date);
}

export function formatBatchMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "current month";
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila"
  }).format(date);
}

export function stockStatusVariant(candidate: RestockPlanningCandidate) {
  switch (candidate.stockHealth.status) {
    case "OUT_OF_STOCK":
      return "danger" as const;
    case "LOW_STOCK":
      return "warning" as const;
    case "OVERSTOCK":
      return "info" as const;
    case "NORMAL":
    default:
      return "success" as const;
  }
}

export function stockStatusLabel(candidate: RestockPlanningCandidate) {
  switch (candidate.stockHealth.status) {
    case "OUT_OF_STOCK":
      return "Out of Stock";
    case "LOW_STOCK":
      return "Low Stock";
    case "OVERSTOCK":
      return "Overstock";
    case "NORMAL":
    default:
      return "Normal";
  }
}

export function sourceLabel(candidate: RestockPlanningCandidate) {
  if (candidate.recommendationSource === "SARIMA") return "Forecast";
  if (candidate.recommendationSource === "LOW_STOCK") return "Stock level";
  return "Stock policy";
}

export function riskLabel(risk: RestockForecastRisk | null | undefined) {
  switch (risk) {
    case "CRITICAL":
      return "Urgent";
    case "HIGH":
      return "High priority";
    case "MEDIUM":
      return "Plan soon";
    case "LOW":
    default:
      return "Monitor";
  }
}

export function orderStatusLabel(status: RestockOrderStatus) {
  switch (status) {
    case "APPROVED":
    case "AWAITING_DELIVERY":
      return "Ready to receive";
    case "PARTIALLY_RECEIVED":
      return "Partially received";
    case "RECEIVED":
      return "Received";
    case "CANCELLED":
      return "Cancelled";
    case "DRAFT":
    default:
      return "Draft";
  }
}

export function buildDemandChart(candidate: RestockPlanningCandidate | null) {
  if (!candidate?.forecast) return [];

  const historical = candidate.forecast.historical.slice(-6).map((point) => ({
    actual: point.quantitySold,
    forecast: null,
    label: formatMonth(point.period),
    period: point.period
  }));
  const forecast = candidate.forecast.points.slice(0, 6).map((point) => ({
    actual: null,
    forecast: point.predictedQuantity,
    label: formatMonth(point.period),
    period: point.period
  }));

  return [...historical, ...forecast];
}

export function usableStock(candidate: RestockPlanningCandidate | null) {
  if (!candidate) return 0;
  return Math.max(
    0,
    candidate.sellableStock + candidate.incomingStock - candidate.expiryRiskQuantity
  );
}

export function coverageLabel(candidate: RestockPlanningCandidate | null) {
  const coverageDays = candidate?.stockHealth.coverageDays;
  if (coverageDays === null || coverageDays === undefined || !Number.isFinite(coverageDays)) {
    return "-";
  }
  return `${Math.max(0, Math.round(coverageDays))} days`;
}

function nextMonthDate(candidate: RestockPlanningCandidate | null) {
  const forecastPeriod = candidate?.forecast?.points[0]?.period;
  if (forecastPeriod) {
    const forecastDate = new Date(forecastPeriod);
    if (!Number.isNaN(forecastDate.getTime())) return forecastDate;
  }

  const fallback = new Date();
  return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth() + 1, 1));
}

export function buildNextMonthRestockPreview(
  candidate: RestockPlanningCandidate | null,
  activeRestock: ActiveProductRestock | null
): NextMonthRestockPreview | null {
  if (!candidate) return null;

  const previewDate = nextMonthDate(candidate);
  const expectedDemand = Math.max(
    0,
    Math.ceil(
      candidate.forecast?.points[0]?.predictedQuantity ??
        candidate.forecastDecision?.currentMonthDemand ??
        candidate.forecast?.currentMonthDemand ??
        0
    )
  );
  const currentDemand = Math.max(
    0,
    Math.ceil(
      candidate.forecastDecision?.currentMonthDemand ?? candidate.forecast?.currentMonthDemand ?? 0
    )
  );
  const projectedOpeningStock = Math.max(0, usableStock(candidate) - currentDemand);
  const targetStockLevel = Math.max(0, candidate.product.targetStockLevel);
  const reorderLevel = Math.max(0, candidate.product.reorderLevel);
  const demandGap = Math.max(
    0,
    Math.ceil(targetStockLevel + expectedDemand - projectedOpeningStock)
  );
  const reorderGap =
    reorderLevel > 0 && projectedOpeningStock <= reorderLevel
      ? Math.max(0, Math.ceil(reorderLevel + 1 - projectedOpeningStock))
      : 0;
  const monthIndex = previewDate.getUTCMonth();
  const year = previewDate.getUTCFullYear();
  const activeIncoming = Math.max(
    0,
    Math.ceil(candidate.incomingStock),
    Math.ceil(activeRestock?.totalRemaining ?? 0)
  );

  return {
    batchNumber: `RO-${MONTH_ABBREVIATIONS[monthIndex]}-${year}`,
    currentCycleQuantity: activeIncoming,
    estimatedRestock: Math.max(demandGap, reorderGap),
    expectedDemand,
    monthLabel: new Intl.DateTimeFormat("en-PH", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(previewDate),
    monthShortLabel: new Intl.DateTimeFormat("en-PH", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC"
    }).format(previewDate),
    projectedOpeningStock
  };
}

export function buildRestockPreviewChart(preview: NextMonthRestockPreview | null) {
  if (!preview) return [];
  const currentLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Manila"
  }).format(new Date());

  return [
    { label: currentLabel, restock: preview.currentCycleQuantity },
    { label: preview.monthShortLabel, restock: preview.estimatedRestock }
  ];
}

export async function loadAllRestockPlanningCandidates(signal: AbortSignal) {
  const firstPage = await listRestockPlanning(
    { includeZero: true, page: 1, pageSize: WATCHLIST_FETCH_PAGE_SIZE },
    { signal }
  );
  if (firstPage.meta.totalPages <= 1) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
      listRestockPlanning(
        {
          includeZero: true,
          page: index + 2,
          pageSize: WATCHLIST_FETCH_PAGE_SIZE
        },
        { signal }
      )
    )
  );
  return [firstPage.items, ...remainingPages.map((page) => page.items)].flat();
}

export async function loadAllActiveRestockOrders(signal: AbortSignal) {
  const firstPage = await listRestockOrders(
    { statuses: ACTIVE_RESTOCK_STATUSES, page: 1, pageSize: WATCHLIST_FETCH_PAGE_SIZE },
    { signal }
  );
  if (firstPage.meta.totalPages <= 1) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
      listRestockOrders(
        {
          statuses: ACTIVE_RESTOCK_STATUSES,
          page: index + 2,
          pageSize: WATCHLIST_FETCH_PAGE_SIZE
        },
        { signal }
      )
    )
  );
  return [firstPage.items, ...remainingPages.map((page) => page.items)].flat();
}

export function buildActiveRestockByProduct(orders: RestockOrder[]) {
  const byProduct = new Map<string, ActiveProductRestock>();

  for (const order of orders) {
    const monthly = order.notes?.includes("[AutomatedRestockMonth:") ?? false;
    const automated = monthly || (order.notes?.includes("[AutomatedRestock:") ?? false);

    for (const line of order.lines) {
      const remaining = Math.max(0, line.requestedQuantity - line.receivedQuantity);
      if (remaining <= 0) continue;

      const current = byProduct.get(line.product.id);
      const orderUpdatedAt = new Date(order.updatedAt).getTime();
      const currentUpdatedAt = current ? new Date(current.latestUpdatedAt).getTime() : -Infinity;
      const isLatest = !current || orderUpdatedAt >= currentUpdatedAt;

      byProduct.set(line.product.id, {
        automated: (current?.automated ?? false) || automated,
        latestCreatedAt: isLatest ? order.createdAt : current.latestCreatedAt,
        latestOrderNumber: isLatest ? order.orderNumber : current.latestOrderNumber,
        latestStatus: isLatest ? order.status : current.latestStatus,
        latestUpdatedAt: isLatest ? order.updatedAt : current.latestUpdatedAt,
        monthly: isLatest ? monthly : current.monthly,
        ticketCount: (current?.ticketCount ?? 0) + 1,
        totalRemaining: (current?.totalRemaining ?? 0) + remaining
      });
    }
  }

  return byProduct;
}
