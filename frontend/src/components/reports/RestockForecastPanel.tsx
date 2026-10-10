import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
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
import {
  RISK_PRIORITY,
  WATCHLIST_PAGE_SIZE,
  buildActiveRestockByProduct,
  buildAllProductsRestockPreview,
  buildDemandChart,
  buildNextMonthRestockPreview,
  buildRestockPreviewChart,
  coverageLabel,
  formatBatchMonth,
  formatDate,
  formatNumber,
  loadAllActiveRestockOrders,
  loadAllRestockPlanningCandidates,
  orderStatusLabel,
  riskLabel,
  sourceLabel,
  stockStatusLabel,
  stockStatusVariant,
  usableStock
} from "@/components/reports/restockForecastViewModel";
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
import type {
  RestockForecastRisk,
  RestockOrder,
  RestockPlanningCandidate
} from "@/services/restockApi";

type ChartView = "DEMAND" | "RESTOCK" | "ALL";

type MonthlyRecommendationAction =
  | "RESTOCK"
  | "REDUCE_REPLENISHMENT"
  | "EXPIRY_REVIEW"
  | "NO_ACTION";

const reportMonthFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  timeZone: "Asia/Manila",
  year: "numeric"
});

function monthlyRecommendationAction(
  candidate: RestockPlanningCandidate
): MonthlyRecommendationAction {
  if (candidate.recommendedQuantity > 0) return "RESTOCK";
  if (candidate.expiryRiskQuantity > 0) return "EXPIRY_REVIEW";
  if (candidate.stockHealth.status === "OVERSTOCK") return "REDUCE_REPLENISHMENT";
  return "NO_ACTION";
}

function monthlyRecommendationLabel(action: MonthlyRecommendationAction) {
  switch (action) {
    case "RESTOCK":
      return "Restock";
    case "EXPIRY_REVIEW":
      return "Expiry review";
    case "REDUCE_REPLENISHMENT":
      return "Reduce replenishment";
    case "NO_ACTION":
    default:
      return "No action";
  }
}

function monthlyRecommendationVariant(action: MonthlyRecommendationAction) {
  switch (action) {
    case "RESTOCK":
      return "warning" as const;
    case "EXPIRY_REVIEW":
      return "danger" as const;
    case "REDUCE_REPLENISHMENT":
      return "info" as const;
    case "NO_ACTION":
    default:
      return "success" as const;
  }
}

export function RestockForecastPanel({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [items, setItems] = useState<RestockPlanningCandidate[]>([]);
  const [activeOrders, setActiveOrders] = useState<RestockOrder[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localRefreshVersion, setLocalRefreshVersion] = useState(0);
  const [watchlistPage, setWatchlistPage] = useState(1);
  const [chartView, setChartView] = useState<ChartView>("DEMAND");
  const detailTransitionRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setChartView("DEMAND");
  }, [selectedProductId]);

  useLayoutEffect(() => {
    const container = detailTransitionRef.current;
    if (!container || !selectedProductId) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sections = Array.from(
      container.querySelectorAll<HTMLElement>("[data-product-transition]")
    );
    const animations = sections
      .filter((section) => typeof section.animate === "function")
      .map((section, index) =>
        section.animate(
          [
            { opacity: 0.48, transform: "translateY(5px)" },
            { opacity: 1, transform: "translateY(0)" }
          ],
          {
            delay: Math.min(index * 22, 88),
            duration: 180,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
            fill: "both"
          }
        )
      );

    return () => {
      animations.forEach((animation) => animation.cancel());
    };
  }, [selectedProductId]);

  const activeRestockByProduct = useMemo(
    () => buildActiveRestockByProduct(activeOrders),
    [activeOrders]
  );
  const selected = useMemo(
    () => items.find((item) => item.product.id === selectedProductId) ?? null,
    [items, selectedProductId]
  );
  const selectedActiveRestock = selected
    ? (activeRestockByProduct.get(selected.product.id) ?? null)
    : null;
  const productDemandChart = useMemo(() => buildDemandChart(selected), [selected]);
  const nextMonthPreview = useMemo(
    () => buildNextMonthRestockPreview(selected, selectedActiveRestock),
    [selected, selectedActiveRestock]
  );
  const allProductsPreview = useMemo(
    () => buildAllProductsRestockPreview(items, activeRestockByProduct),
    [activeRestockByProduct, items]
  );
  const displayedPreview = chartView === "ALL" ? allProductsPreview : nextMonthPreview;
  const restockPreviewChart = useMemo(
    () => buildRestockPreviewChart(displayedPreview),
    [displayedPreview]
  );
  const watchlistTotalPages = Math.max(1, Math.ceil(items.length / WATCHLIST_PAGE_SIZE));
  const normalizedWatchlistPage = Math.min(watchlistPage, watchlistTotalPages);
  const watchlistStart = (normalizedWatchlistPage - 1) * WATCHLIST_PAGE_SIZE;
  const visibleItems = useMemo(
    () => items.slice(watchlistStart, watchlistStart + WATCHLIST_PAGE_SIZE),
    [items, watchlistStart]
  );
  const reportMonthLabel = reportMonthFormatter.format(new Date());
  const summary = useMemo(() => {
    let restock = 0;
    let reduce = 0;
    let expiry = 0;

    for (const item of items) {
      switch (monthlyRecommendationAction(item)) {
        case "RESTOCK":
          restock += 1;
          break;
        case "REDUCE_REPLENISHMENT":
          reduce += 1;
          break;
        case "EXPIRY_REVIEW":
          expiry += 1;
          break;
        default:
          break;
      }
    }

    return {
      actionCount: restock + reduce + expiry,
      expiry,
      products: items.length,
      reduce,
      restock,
      units: items.reduce((sum, item) => sum + Math.max(0, item.recommendedQuantity), 0)
    };
  }, [items]);

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
              <CardTitle>{reportMonthLabel} inventory recommendation report</CardTitle>
              <Badge variant={summary.actionCount > 0 ? "warning" : "success"}>
                {summary.actionCount > 0
                  ? `${summary.actionCount.toLocaleString()} need action`
                  : "All clear"}
              </Badge>
              <Badge variant="info">Live month</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Complete current-month view across all products. The report updates as sales, stock,
              incoming supply, expiry exposure, and forecast guidance change.
            </p>
          </div>
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
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ForecastMetric label="Products analyzed" value={summary.products} />
          <ForecastMetric label="Restock" value={summary.restock} />
          <ForecastMetric label="Reduce" value={summary.reduce} />
          <ForecastMetric label="Expiry review" value={summary.expiry} />
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
              <p className="text-sm font-semibold text-slate-950">Monthly product report</p>
              <p className="mt-1 text-xs text-slate-500">
                All products are included. Use pagination to review each recommendation without
                stretching the page.
              </p>
            </div>
            <div className="overflow-hidden">
              {items.length > 0 ? (
                <Table aria-label="Forecast product watchlist">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Recommendation</TableHead>
                      <TableHead className="text-right">Sellable</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.map((item) => {
                      const selectedRow = item.product.id === selectedProductId;
                      const activeRestock = activeRestockByProduct.get(item.product.id) ?? null;
                      return (
                        <TableRow
                          aria-label={`View forecast for ${item.product.name}`}
                          aria-pressed={selectedRow}
                          data-selected={selectedRow}
                          className={`ys-restock-product-row cursor-pointer select-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                            selectedRow
                              ? "bg-indigo-50/70 hover:bg-indigo-50/80"
                              : "hover:bg-slate-50"
                          }`}
                          key={item.product.id}
                          onClick={() => setSelectedProductId(item.product.id)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            setSelectedProductId(item.product.id);
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <TableCell className="max-w-[16rem]">
                            <span className="block truncate font-medium text-slate-950">
                              {item.product.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {sourceLabel(item)} · {item.product.sku}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              title={item.rationale}
                              variant={monthlyRecommendationVariant(
                                monthlyRecommendationAction(item)
                              )}
                            >
                              {monthlyRecommendationLabel(monthlyRecommendationAction(item))}
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
                              <div title={`Included in ${activeRestock.latestOrderNumber}`}>
                                <span className="font-semibold text-indigo-700">
                                  {formatNumber(activeRestock.totalRemaining)}
                                </span>
                                <span className="block text-[11px] font-medium text-indigo-600">
                                  incoming
                                </span>
                              </div>
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

          <div
            className="min-w-0 rounded-lg border border-slate-200 bg-white"
            ref={detailTransitionRef}
          >
            <div
              className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3"
              data-product-transition
            >
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
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-product-transition>
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
                <div data-product-transition>
                  <RecommendationCard
                    activeRestock={selectedActiveRestock}
                    demand={selectedDemand}
                    hasProcessedOrder={selectedHasProcessedOrder}
                    needsOrder={selectedNeedsOrder}
                    risk={selectedRisk}
                    selected={selected}
                  />
                </div>
              ) : null}

              <div data-product-transition>
                <div className="mb-2 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {chartView === "DEMAND"
                        ? "Expected monthly demand"
                        : chartView === "RESTOCK"
                          ? "Restock plan"
                          : "All products restock plan"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {chartView === "DEMAND"
                        ? "Gray shows recent sales. Blue shows expected demand for the selected product."
                        : chartView === "RESTOCK"
                          ? "Compare this product's active incoming quantity with its estimated next monthly restock."
                          : "Compare total active incoming stock with the estimated next monthly batch across all products."}
                    </p>
                  </div>
                  <ChartViewSwitch view={chartView} onChange={setChartView} />
                </div>
                <div className="relative h-56 rounded-md border border-slate-200 bg-white p-2">
                  {chartView === "DEMAND" ? (
                    productDemandChart.length > 0 ? (
                      <DemandChart data={productDemandChart} />
                    ) : (
                      <ChartEmptyState
                        detail="Demand trend will appear when this product has POS sales activity."
                        title="Forecast chart ready"
                      />
                    )
                  ) : restockPreviewChart.length > 0 ? (
                    <RestockPreviewChart data={restockPreviewChart} />
                  ) : (
                    <ChartEmptyState
                      detail={
                        chartView === "ALL"
                          ? "Restock totals will appear when products have incoming or projected replenishment."
                          : "Select a product to view its restock plan."
                      }
                      title="Restock plan ready"
                    />
                  )}
                </div>
              </div>

              {displayedPreview ? (
                <div
                  className="ys-restock-month-preview rounded-lg border border-indigo-200 bg-indigo-50/60 p-4"
                  data-product-transition
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="ys-restock-month-preview-label text-xs font-semibold uppercase tracking-wide text-indigo-700">
                        {chartView === "ALL"
                          ? "All products next month preview"
                          : "Next month restock preview"}
                      </p>
                      <p className="ys-restock-month-preview-title mt-1 text-lg font-semibold text-indigo-950">
                        {displayedPreview.monthLabel}
                        {chartView === "ALL" && allProductsPreview
                          ? ` · ${allProductsPreview.productsToRestock.toLocaleString()} products projected`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="info">Preview only</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <ForecastMetric
                      compact
                      label="Expected demand"
                      value={displayedPreview.expectedDemand}
                    />
                    <ForecastMetric
                      compact
                      label={chartView === "ALL" ? "Current incoming" : "Projected stock"}
                      value={
                        chartView === "ALL"
                          ? displayedPreview.currentCycleQuantity
                          : displayedPreview.projectedOpeningStock
                      }
                    />
                    <ForecastMetric
                      compact
                      label="Estimated restock"
                      value={displayedPreview.estimatedRestock}
                    />
                    <ForecastMetric
                      compact
                      label="Planned batch"
                      value={displayedPreview.batchNumber}
                    />
                  </div>
                  <p className="ys-restock-month-preview-note mt-3 text-xs leading-5 text-indigo-800">
                    {chartView === "ALL"
                      ? "This store-wide preview aggregates operational POS demand, sellable stock, active incoming quantities, expiry risk, and stock policy for all products. It is not counted as new incoming stock and does not create the next monthly ticket yet."
                      : "This is an estimate based on current POS demand, sellable and incoming stock, expiry risk, and stock policy. It is not counted as incoming stock and does not create the next monthly ticket yet. The quantity will be recalculated when the next batch cycle starts."}
                  </p>
                </div>
              ) : null}

              {selected && selectedCoverageDays !== null ? (
                <p className="text-xs leading-5 text-slate-500" data-product-transition>
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

function RecommendationCard({
  activeRestock,
  demand,
  hasProcessedOrder,
  needsOrder,
  risk,
  selected
}: {
  activeRestock: ReturnType<typeof buildActiveRestockByProduct> extends Map<string, infer T>
    ? T | null
    : never;
  demand: number;
  hasProcessedOrder: boolean;
  needsOrder: boolean;
  risk: RestockForecastRisk | null;
  selected: RestockPlanningCandidate;
}) {
  const tone = needsOrder ? "amber" : hasProcessedOrder ? "indigo" : "emerald";
  const classes = {
    amber: {
      box: "border-amber-200 bg-amber-50",
      body: "text-amber-900",
      label: "text-amber-700",
      meta: "text-amber-800",
      title: "text-amber-950"
    },
    emerald: {
      box: "border-emerald-200 bg-emerald-50",
      body: "text-emerald-900",
      label: "text-emerald-700",
      meta: "text-emerald-800",
      title: "text-emerald-950"
    },
    indigo: {
      box: "border-indigo-200 bg-indigo-50",
      body: "text-indigo-900",
      label: "text-indigo-700",
      meta: "text-indigo-800",
      title: "text-indigo-950"
    }
  }[tone];

  return (
    <div
      className={`ys-restock-recommendation rounded-md border px-4 py-3 ${classes.box}`}
      data-tone={tone}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`ys-restock-recommendation-label text-xs font-semibold uppercase tracking-wide ${classes.label}`}
          >
            {hasProcessedOrder ? "Restock batch" : "Recommended next step"}
          </p>
          <p
            className={`ys-restock-recommendation-title mt-1 text-lg font-semibold ${classes.title}`}
          >
            {needsOrder
              ? `Order ${formatNumber(selected.recommendedQuantity)} units`
              : hasProcessedOrder && activeRestock
                ? activeRestock.monthly
                  ? `Included in ${formatBatchMonth(activeRestock.latestCreatedAt)} restock batch`
                  : "Included in active restock ticket"
                : "No order needed right now"}
          </p>
          <p className={`ys-restock-recommendation-body mt-1 text-sm leading-6 ${classes.body}`}>
            {needsOrder
              ? `Place the order by ${formatDate(selected.forecastDecision?.recommendedActionDate)}. Current usable stock covers about ${coverageLabel(selected)} at roughly ${formatNumber(demand)} units per month.`
              : hasProcessedOrder && activeRestock
                ? `${formatNumber(activeRestock.totalRemaining)} units are included in ${activeRestock.latestOrderNumber}, which is ${orderStatusLabel(activeRestock.latestStatus).toLowerCase()}. Incoming stock is already included in the plan, so no additional restock quantity is required.`
                : "Current usable stock is expected to cover demand. Keep monitoring this product for changes."}
          </p>
        </div>
        <Badge variant={needsOrder ? "warning" : "success"}>
          {hasProcessedOrder && activeRestock
            ? orderStatusLabel(activeRestock.latestStatus)
            : riskLabel(risk)}
        </Badge>
      </div>
      <div
        className={`ys-restock-recommendation-meta mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs ${classes.meta}`}
      >
        <span>Sellable {formatNumber(selected.sellableStock)}</span>
        <span>Incoming {formatNumber(selected.incomingStock)}</span>
        <span>Expiry risk {formatNumber(selected.expiryRiskQuantity)}</span>
        {hasProcessedOrder && activeRestock ? (
          <>
            <span>
              {activeRestock.monthly ? "Batch" : "Ticket"} {activeRestock.latestOrderNumber}
            </span>
            <span>
              {activeRestock.automated
                ? activeRestock.monthly
                  ? "Automated monthly batch"
                  : "Automated restock"
                : "Restock ticket"}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ChartViewSwitch({
  onChange,
  view
}: {
  onChange: (view: ChartView) => void;
  view: ChartView;
}) {
  const options: Array<{ label: string; value: ChartView }> = [
    { label: "Demand", value: "DEMAND" },
    { label: "Restock plan", value: "RESTOCK" },
    { label: "All products", value: "ALL" }
  ];

  return (
    <div
      aria-label="Forecast chart view"
      className="inline-flex w-fit rounded-md border border-slate-200 bg-slate-50 p-1"
      role="group"
    >
      {options.map((option) => (
        <button
          aria-pressed={view === option.value}
          className={
            view === option.value
              ? "rounded bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200"
              : "rounded px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-950"
          }
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DemandChart({ data }: { data: ReturnType<typeof buildDemandChart> }) {
  return (
    <ResponsiveContainer height="100%" width="100%">
      <LineChart data={data} margin={{ bottom: 4, left: 0, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" minTickGap={18} tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={38} />
        <Tooltip formatter={(value, name) => [formatNumber(Number(value), 1), String(name)]} />
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
  );
}

function RestockPreviewChart({ data }: { data: ReturnType<typeof buildRestockPreviewChart> }) {
  return (
    <ResponsiveContainer height="100%" width="100%">
      <BarChart data={data} margin={{ bottom: 4, left: 0, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={38} />
        <Tooltip formatter={(value) => [formatNumber(Number(value)), "Restock units"]} />
        <Bar dataKey="restock" fill="#4f46e5" name="Restock units" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartEmptyState({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
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
