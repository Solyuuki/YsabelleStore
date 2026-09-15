import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { AppPagination } from "@/components/shared/AppPagination";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  listRestockOrders,
  listRestockPlanning,
  type RestockForecastRisk,
  type RestockOrder,
  type RestockOrderStatus,
  type RestockPlanningCandidate
} from "@/services/restockApi";

const RISK_PRIORITY: Record<RestockForecastRisk, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const ACTIVE_RESTOCK_STATUSES = [
  "APPROVED",
  "AWAITING_DELIVERY",
  "PARTIALLY_RECEIVED"
] as const satisfies readonly RestockOrderStatus[];
const WATCHLIST_FETCH_PAGE_SIZE = 100;
const WATCHLIST_PAGE_SIZE = 10;

type ActiveProductRestock = {
  automated: boolean;
  latestCreatedAt: string;
  latestOrderNumber: string;
  latestStatus: RestockOrderStatus;
  latestUpdatedAt: string;
  monthly: boolean;
  ticketCount: number;
  totalRemaining: number;
};

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 7);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC"
  }).format(date);
}

function formatBatchMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "current month";
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila"
  }).format(date);
}

function stockStatusVariant(candidate: RestockPlanningCandidate) {
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

function stockStatusLabel(candidate: RestockPlanningCandidate) {
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

function sourceLabel(candidate: RestockPlanningCandidate) {
  if (candidate.recommendationSource === "SARIMA") return "Forecast";
  if (candidate.recommendationSource === "LOW_STOCK") return "Stock level";
  return "Stock policy";
}

function riskLabel(risk: RestockForecastRisk | null | undefined) {
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

function orderStatusLabel(status: RestockOrderStatus) {
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

function buildDemandChart(candidate: RestockPlanningCandidate | null) {
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

function usableStock(candidate: RestockPlanningCandidate | null) {
  if (!candidate) return 0;
  return Math.max(
    0,
    candidate.sellableStock + candidate.incomingStock - candidate.expiryRiskQuantity
  );
}

function coverageLabel(candidate: RestockPlanningCandidate | null) {
  const coverageDays = candidate?.stockHealth.coverageDays;
  if (coverageDays === null || coverageDays === undefined || !Number.isFinite(coverageDays)) {
    return "-";
  }
  return `${Math.max(0, Math.round(coverageDays))} days`;
}

async function loadAllRestockPlanningCandidates(signal: AbortSignal) {
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

async function loadAllActiveRestockOrders(signal: AbortSignal) {
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

function buildActiveRestockByProduct(orders: RestockOrder[]) {
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

export function RestockForecastPanel({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [items, setItems] = useState<RestockPlanningCandidate[]>([]);
  const [activeOrders, setActiveOrders] = useState<RestockOrder[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localRefreshVersion, setLocalRefreshVersion] = useState(0);
  const [watchlistPage, setWatchlistPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [planningItems, currentOrders] = await Promise.all([
          loadAllRestockPlanningCandidates(controller.signal),
          loadAllActiveRestockOrders(controller.signal)
        ]);
        if (!active) return;

        const sorted = [...planningItems].sort((left, right) => {
          const leftRisk = left.forecastDecision?.riskLevel ?? "LOW";
          const rightRisk = right.forecastDecision?.riskLevel ?? "LOW";
          const riskDifference = RISK_PRIORITY[rightRisk] - RISK_PRIORITY[leftRisk];
          if (riskDifference !== 0) return riskDifference;
          return right.recommendedQuantity - left.recommendedQuantity;
        });

        setItems(sorted);
        setActiveOrders(currentOrders);
        setSelectedProductId((current) => {
          if (current && sorted.some((item) => item.product.id === current)) return current;
          return (
            sorted.find((item) => item.forecast?.points.length)?.product.id ??
            sorted[0]?.product.id ??
            null
          );
        });
      } catch (requestError) {
        if (!active || controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Restock recommendations could not be loaded."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [localRefreshVersion, refreshVersion]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(items.length / WATCHLIST_PAGE_SIZE));
    setWatchlistPage((current) => Math.min(current, totalPages));
  }, [items.length]);

  const activeRestockByProduct = useMemo(
    () => buildActiveRestockByProduct(activeOrders),
    [activeOrders]
  );
  const selected = useMemo(
    () => items.find((item) => item.product.id === selectedProductId) ?? null,
    [items, selectedProductId]
  );
  const selectedActiveRestock = selected ? activeRestockByProduct.get(selected.product.id) ?? null : null;
  const actionableItems = useMemo(
    () => items.filter((item) => item.recommendedQuantity > 0),
    [items]
  );
  const demandChart = useMemo(() => buildDemandChart(selected), [selected]);
  const watchlistTotalPages = Math.max(1, Math.ceil(items.length / WATCHLIST_PAGE_SIZE));
  const normalizedWatchlistPage = Math.min(watchlistPage, watchlistTotalPages);
  const watchlistStart = (normalizedWatchlistPage - 1) * WATCHLIST_PAGE_SIZE;
  const visibleItems = useMemo(
    () => items.slice(watchlistStart, watchlistStart + WATCHLIST_PAGE_SIZE),
    [items, watchlistStart]
  );
  const summary = useMemo(() => {
    const highRisk = actionableItems.filter((item) => {
      const risk = item.forecastDecision?.riskLevel;
      return risk === "HIGH" || risk === "CRITICAL";
    }).length;
    const nextSevenDays = Date.now() + 7 * 86_400_000;
    const sevenDayStockouts = actionableItems.filter((item) => {
      const stockout = item.forecastDecision?.projectedStockoutDate;
      if (!stockout) return false;
      const timestamp = new Date(stockout).getTime();
      return Number.isFinite(timestamp) && timestamp <= nextSevenDays;
    }).length;

    return {
      actionCount: actionableItems.length,
      highRisk,
      sevenDayStockouts,
      units: actionableItems.reduce((sum, item) => sum + Math.max(0, item.recommendedQuantity), 0)
    };
  }, [actionableItems]);

  const selectedDemand = Math.ceil(
    selected?.forecastDecision?.currentMonthDemand ?? selected?.forecast?.currentMonthDemand ?? 0
  );
  const selectedCoverageDays = selected?.stockHealth.coverageDays ?? null;
  const selectedRisk = selected?.forecastDecision?.riskLevel ?? null;
  const selectedNeedsOrder = Boolean(selected && selected.recommendedQuantity > 0);
  const selectedHasProcessedOrder = Boolean(
    !selectedNeedsOrder && selectedActiveRestock && selectedActiveRestock.totalRemaining > 0
  );

  function handleWatchlistPageChange(nextPage: number) {
    const page = Math.min(Math.max(nextPage, 1), watchlistTotalPages);
    setWatchlistPage(page);

    const start = (page - 1) * WATCHLIST_PAGE_SIZE;
    const pageItems = items.slice(start, start + WATCHLIST_PAGE_SIZE);
    const firstPageItem = pageItems[0];
    if (firstPageItem && !pageItems.some((item) => item.product.id === selectedProductId)) {
      setSelectedProductId(firstPageItem.product.id);
    }
  }

  if (loading && items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingState
            badge="Forecast"
            helper="Reading recent demand and current stock."
            label="Preparing restock guidance"
          />
        </CardContent>
      </Card>
    );
  }

  if (error && items.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-slate-950">Restock forecast unavailable</p>
              <p className="mt-1 text-xs text-slate-500">{error}</p>
            </div>
          </div>
          <Button
            onClick={() => setLocalRefreshVersion((version) => version + 1)}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Restock forecast</CardTitle>
              <Badge variant={summary.actionCount > 0 ? "warning" : "success"}>
                {summary.actionCount > 0
                  ? `${summary.actionCount.toLocaleString()} need action`
                  : "Stock covered"}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              See which products need restocking, when to order, and how many units to buy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading}
              onClick={() => setLocalRefreshVersion((version) => version + 1)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ForecastMetric label="Needs restock" value={summary.actionCount} />
          <ForecastMetric label="Urgent" value={summary.highRisk} />
          <ForecastMetric label="Running out within 7d" value={summary.sevenDayStockouts} />
          <ForecastMetric label="Units to order" value={summary.units} />
        </div>

        {summary.actionCount === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-950">No new restock action required</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Current stock and active restock batches cover the current replenishment plan.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-950">Forecast watchlist</p>
              <p className="mt-1 text-xs text-slate-500">
                Select a product to see expected demand and the recommended next step.
              </p>
            </div>
            <div className="overflow-hidden">
              {items.length > 0 ? (
                <Table aria-label="Forecast product watchlist">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Sellable</TableHead>
                      <TableHead className="text-right">Restock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.map((item) => {
                      const selectedRow = item.product.id === selectedProductId;
                      const activeRestock = activeRestockByProduct.get(item.product.id) ?? null;
                      return (
                        <TableRow
                          className={selectedRow ? "bg-indigo-50/70" : "hover:bg-slate-50"}
                          key={item.product.id}
                        >
                          <TableCell className="max-w-[16rem]">
                            <button
                              className="w-full text-left"
                              onClick={() => setSelectedProductId(item.product.id)}
                              type="button"
                            >
                              <span className="block truncate font-medium text-slate-950">
                                {item.product.name}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {sourceLabel(item)} · {item.product.sku}
                              </span>
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge
                              title={item.stockHealth.reason}
                              variant={stockStatusVariant(item)}
                            >
                              {stockStatusLabel(item)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(item.sellableStock)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.recommendedQuantity > 0 ? (
                              <div>
                                <span className="font-semibold text-amber-800">
                                  {formatNumber(item.recommendedQuantity)}
                                </span>
                                <span className="block text-[11px] font-medium text-amber-700">
                                  to order
                                </span>
                              </div>
                            ) : activeRestock && activeRestock.totalRemaining > 0 ? (
                              <span
                                className="font-semibold text-indigo-700"
                                title={`Included in ${activeRestock.latestOrderNumber}`}
                              >
                                {formatNumber(activeRestock.totalRemaining)}
                              </span>
                            ) : (
                              <span className="font-semibold text-slate-950">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-950">No forecast products yet</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Demand guidance will appear here when enough sales history is available.
                  </p>
                </div>
              )}
            </div>
            {items.length > 0 ? (
              <AppPagination
                className="rounded-none border-x-0 border-b-0"
                isLoading={loading}
                itemLabel="products"
                onPageChange={handleWatchlistPageChange}
                page={normalizedWatchlistPage}
                pageSize={WATCHLIST_PAGE_SIZE}
                totalItems={items.length}
                totalPages={watchlistTotalPages}
              />
            ) : null}
          </div>

          <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {selected?.product.name ?? "Restock details"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selected?.forecast
                    ? `Expected demand · Updated ${formatDate(selected.forecast.generatedAt)}`
                    : "Select a product to review its stock outlook."}
                </p>
              </div>
              {selected ? (
                <Badge title={selected.stockHealth.reason} variant={stockStatusVariant(selected)}>
                  {stockStatusLabel(selected)}
                </Badge>
              ) : null}
            </div>

            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ForecastMetric compact label="Usable stock" value={usableStock(selected)} />
                <ForecastMetric compact label="Expected 30d" value={selectedDemand} />
                <ForecastMetric compact label="Stock cover" value={coverageLabel(selected)} />
                <ForecastMetric
                  compact
                  label="May run out"
                  value={formatDate(selected?.forecastDecision?.projectedStockoutDate)}
                />
              </div>

              {selected ? (
                <div
                  className={
                    selectedNeedsOrder
                      ? "rounded-md border border-amber-200 bg-amber-50 px-4 py-3"
                      : selectedHasProcessedOrder
                        ? "rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3"
                        : "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={
                          selectedNeedsOrder
                            ? "text-xs font-semibold uppercase tracking-wide text-amber-700"
                            : selectedHasProcessedOrder
                              ? "text-xs font-semibold uppercase tracking-wide text-indigo-700"
                              : "text-xs font-semibold uppercase tracking-wide text-emerald-700"
                        }
                      >
                        {selectedHasProcessedOrder ? "Restock batch" : "Recommended next step"}
                      </p>
                      <p
                        className={
                          selectedNeedsOrder
                            ? "mt-1 text-lg font-semibold text-amber-950"
                            : selectedHasProcessedOrder
                              ? "mt-1 text-lg font-semibold text-indigo-950"
                              : "mt-1 text-lg font-semibold text-emerald-950"
                        }
                      >
                        {selectedNeedsOrder
                          ? `Order ${formatNumber(selected.recommendedQuantity)} units`
                          : selectedHasProcessedOrder && selectedActiveRestock
                            ? selectedActiveRestock.monthly
                              ? `Included in ${formatBatchMonth(selectedActiveRestock.latestCreatedAt)} restock batch`
                              : "Included in active restock ticket"
                            : "No order needed right now"}
                      </p>
                      <p
                        className={
                          selectedNeedsOrder
                            ? "mt-1 text-sm leading-6 text-amber-900"
                            : selectedHasProcessedOrder
                              ? "mt-1 text-sm leading-6 text-indigo-900"
                              : "mt-1 text-sm leading-6 text-emerald-900"
                        }
                      >
                        {selectedNeedsOrder
                          ? `Place the order by ${formatDate(selected.forecastDecision?.recommendedActionDate)}. Current usable stock covers about ${coverageLabel(selected)} at roughly ${formatNumber(selectedDemand)} units per month.`
                          : selectedHasProcessedOrder && selectedActiveRestock
                            ? `${formatNumber(selectedActiveRestock.totalRemaining)} units are included in ${selectedActiveRestock.latestOrderNumber}, which is ${orderStatusLabel(selectedActiveRestock.latestStatus).toLowerCase()}. Incoming stock is already included in the plan, so no additional restock quantity is required.`
                            : "Current usable stock is expected to cover demand. Keep monitoring this product for changes."}
                      </p>
                    </div>
                    <Badge variant={selectedNeedsOrder ? "warning" : "success"}>
                      {selectedHasProcessedOrder && selectedActiveRestock
                        ? orderStatusLabel(selectedActiveRestock.latestStatus)
                        : riskLabel(selectedRisk)}
                    </Badge>
                  </div>
                  <div
                    className={
                      selectedNeedsOrder
                        ? "mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-amber-800"
                        : selectedHasProcessedOrder
                          ? "mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-indigo-800"
                          : "mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-emerald-800"
                    }
                  >
                    <span>Sellable {formatNumber(selected.sellableStock)}</span>
                    <span>Incoming {formatNumber(selected.incomingStock)}</span>
                    <span>Expiry risk {formatNumber(selected.expiryRiskQuantity)}</span>
                    {selectedHasProcessedOrder && selectedActiveRestock ? (
                      <>
                        <span>
                          {selectedActiveRestock.monthly ? "Batch" : "Ticket"}{" "}
                          {selectedActiveRestock.latestOrderNumber}
                        </span>
                        <span>
                          {selectedActiveRestock.automated
                            ? selectedActiveRestock.monthly
                              ? "Automated monthly batch"
                              : "Automated restock"
                            : "Restock ticket"}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-2">
                  <p className="text-sm font-semibold text-slate-950">Expected monthly demand</p>
                  <p className="text-xs text-slate-500">
                    Gray shows recent sales. Blue shows expected demand for the next months.
                  </p>
                </div>
                <div className="relative h-56 rounded-md border border-slate-200 bg-white p-2">
                  {demandChart.length > 0 ? (
                    <ResponsiveContainer height="100%" width="100%">
                      <LineChart
                        data={demandChart}
                        margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" minTickGap={18} tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={38} />
                        <Tooltip
                          formatter={(value, name) => [
                            formatNumber(Number(value), 1),
                            String(name)
                          ]}
                        />
                        <Line
                          connectNulls={false}
                          dataKey="actual"
                          dot={false}
                          name="Recent sales"
                          stroke="#475569"
                          strokeWidth={2}
                          type="monotone"
                        />
                        <Line
                          connectNulls={false}
                          dataKey="forecast"
                          dot={{ r: 2.5 }}
                          name="Expected demand"
                          stroke="#4f46e5"
                          strokeWidth={2.5}
                          type="monotone"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Forecast chart ready</p>
                        <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                          Demand trend will appear here when enough sales history is available.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selected && selectedCoverageDays !== null ? (
                <p className="text-xs leading-5 text-slate-500">
                  Forecasts are estimates. Use this as ordering guidance together with supplier lead
                  time and current store conditions.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastMetric({
  compact = false,
  label,
  value
}: {
  compact?: boolean;
  label: string;
  value: number | string;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
          : "rounded-lg border border-slate-200 bg-white px-4 py-3"
      }
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={
          compact
            ? "mt-1 text-sm font-semibold text-slate-950"
            : "mt-1 text-xl font-semibold text-slate-950"
        }
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
