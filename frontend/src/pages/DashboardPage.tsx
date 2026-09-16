import {
  ArrowRight,
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  LineChart,
  PackageOpen,
  ReceiptText,
  Truck,
  TriangleAlert
} from "lucide-react";
import { useEffect, useState } from "react";

import type { AppRoutePath } from "@/app/routes";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import {
  fetchDashboardOperations,
  fetchDashboardSummary,
  type DashboardOperations,
  type DashboardRestockOrderStatus,
  type DashboardRestockRecommendationSource,
  type DashboardRestockRisk,
  type DashboardSummary
} from "@/services/dashboardApi";
import { getWorkstationPreferences } from "@/services/workstationPreferences";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila"
});

function formatCurrency(value: string) {
  return currencyFormatter.format(Number(value));
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function riskVariant(risk: DashboardRestockRisk) {
  if (risk === "CRITICAL") return "error" as const;
  if (risk === "HIGH" || risk === "MEDIUM") return "warning" as const;
  return "success" as const;
}

function orderStatusVariant(status: DashboardRestockOrderStatus) {
  if (status === "PARTIALLY_RECEIVED" || status === "AWAITING_DELIVERY") {
    return "warning" as const;
  }
  if (status === "RECEIVED") return "success" as const;
  if (status === "CANCELLED") return "error" as const;
  return "info" as const;
}

function orderStatusLabel(status: DashboardRestockOrderStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "APPROVED":
      return "Ready to receive";
    case "AWAITING_DELIVERY":
      return "Awaiting delivery";
    case "PARTIALLY_RECEIVED":
      return "Partially received";
    case "RECEIVED":
      return "Received";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function sourceLabel(source: DashboardRestockRecommendationSource) {
  switch (source) {
    case "LOW_STOCK":
      return "Low stock";
    case "TARGET_STOCK":
      return "Target stock";
    case "SARIMA":
      return "SARIMA";
    case "MANUAL":
      return "Manual";
    default:
      return source;
  }
}

type DashboardPageProps = {
  onNavigate: (path: AppRoutePath) => void;
};

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [operations, setOperations] = useState<DashboardOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationsLoading, setOperationsLoading] = useState(isOwner);
  const [error, setError] = useState<string | null>(null);
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [preferences] = useState(getWorkstationPreferences);

  useEffect(() => {
    let active = true;

    async function loadDashboard(initial = false) {
      if (initial) {
        setLoading(true);
        if (isOwner) setOperationsLoading(true);
      }

      const operationsRequest = isOwner ? fetchDashboardOperations() : Promise.resolve(null);
      const [summaryResult, operationsResult] = await Promise.allSettled([
        fetchDashboardSummary(),
        operationsRequest
      ]);

      if (!active) return;

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
        setError(null);
      } else {
        setError(
          summaryResult.reason instanceof Error
            ? summaryResult.reason.message
            : "Unable to load dashboard summary."
        );
      }

      if (!isOwner) {
        setOperations(null);
        setOperationsError(null);
      } else if (operationsResult.status === "fulfilled") {
        setOperations(operationsResult.value);
        setOperationsError(null);
      } else {
        setOperationsError(
          operationsResult.reason instanceof Error
            ? operationsResult.reason.message
            : "Unable to load operational actions."
        );
      }

      if (initial) setLoading(false);
      setOperationsLoading(false);
    }

    void loadDashboard(true);
    const intervalId =
      preferences.dashboardRefreshSeconds > 0
        ? window.setInterval(
            () => void loadDashboard(false),
            preferences.dashboardRefreshSeconds * 1000
          )
        : null;
    const handleFocus = () => void loadDashboard(false);

    if (preferences.refreshDashboardOnFocus) {
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      active = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      if (preferences.refreshDashboardOnFocus) {
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [isOwner, preferences.dashboardRefreshSeconds, preferences.refreshDashboardOnFocus]);

  const forecastStat = summary
    ? summary.forecast.access === "AVAILABLE"
      ? {
          value: `${summary.forecast.forecastUnits2026.toLocaleString()} units`,
          detail: `${summary.forecast.totalProductsForecasted} products forecasted`,
          tone: summary.forecast.failedProducts > 0 ? ("warning" as const) : ("info" as const)
        }
      : summary.forecast.access === "RESTRICTED"
        ? {
            value: "Protected",
            detail: "Owner verification required",
            tone: "info" as const
          }
        : {
            value: "Unavailable",
            detail: "Forecast is not ready",
            tone: "warning" as const
          }
    : null;

  const dashboardStats = summary
    ? [
        {
          title: "Today's Sales",
          value: formatCurrency(summary.sales.todayAmount),
          detail: formatCount(summary.sales.completedSales, "completed sale"),
          tone: "info" as const,
          icon: ReceiptText
        },
        {
          title: "Inventory Status",
          value: formatCount(summary.inventory.trackedItems, "item"),
          detail:
            summary.inventory.unlinkedCatalogItems === 0
              ? `${summary.inventory.inStockItems} healthy • ${summary.inventory.outOfStockItems} out`
              : `${summary.inventory.unlinkedCatalogItems} catalog items need linking`,
          tone:
            summary.inventory.unlinkedCatalogItems === 0 && summary.inventory.outOfStockItems === 0
              ? ("success" as const)
              : ("warning" as const),
          icon: Boxes
        },
        {
          title: "Low Stock",
          value: formatCount(summary.inventory.lowStockItems, "item"),
          detail:
            summary.inventory.outOfStockItems > 0
              ? `${summary.inventory.outOfStockItems} out of stock`
              : summary.inventory.lowStockItems > 0
                ? "Needs replenishment"
                : "No items flagged",
          tone: "warning" as const,
          icon: PackageOpen
        },
        {
          title: "Near Expiry",
          value: formatCount(summary.expiry.nearExpiryBatches, "batch", "batches"),
          detail:
            summary.expiry.expiredBatches > 0
              ? `${summary.expiry.expiredBatches} expired batches also need attention`
              : `Next ${summary.expiry.windowDays} days`,
          tone: "warning" as const,
          icon: ChartNoAxesCombined
        },
        ...(preferences.showForecastSummary
          ? [
              {
                title: "Forecast Summary",
                value: forecastStat?.value ?? "Unavailable",
                detail: forecastStat?.detail ?? "Forecast is not ready",
                tone: forecastStat?.tone ?? ("info" as const),
                icon: LineChart
              }
            ]
          : [])
      ]
    : [];

  const activityMax = summary
    ? Math.max(1, ...summary.sales.activity.map((bucket) => Number(bucket.totalAmount)))
    : 1;

  const syncItems = summary
    ? [
        {
          label: "Catalog → inventory",
          value:
            summary.inventory.unlinkedCatalogItems === 0
              ? "Synced"
              : `${summary.inventory.unlinkedCatalogItems} missing`,
          variant:
            summary.inventory.unlinkedCatalogItems === 0
              ? ("success" as const)
              : ("warning" as const)
        },
        {
          label: "Catalog products",
          value: String(summary.inventory.catalogItems),
          variant: "info" as const
        },
        {
          label: "Inventory records",
          value: String(summary.inventory.trackedItems),
          variant:
            summary.inventory.unlinkedCatalogItems === 0
              ? ("success" as const)
              : ("warning" as const)
        },
        {
          label: "Available products",
          value: String(summary.inventory.availableItems),
          variant: "info" as const
        },
        {
          label: "Sales today",
          value: String(summary.sales.completedSales),
          variant: "info" as const
        }
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Store overview"
        title="Dashboard"
        description="Live operating view for sales, stock health, replenishment actions, receiving, expiry, and forecast status."
      />

      {loading && !summary ? (
        <LoadingState
          badge="Synchronizing"
          label="Loading live store operations"
          helper="Sales, inventory, expiry, and forecast status are being read from the current database."
        />
      ) : null}

      {error ? (
        <Card>
          <CardContent className="py-4 text-sm text-amber-700">{error}</CardContent>
        </Card>
      ) : null}

      {summary ? (
        <>
          <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {dashboardStats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </section>

          {isOwner ? (
            <section className="grid items-start gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Needs attention</CardTitle>
                      <p className="mt-1 text-xs text-slate-500">
                        Existing restock decisions ranked for quick owner review.
                      </p>
                    </div>
                    {operations ? (
                      <StatusBadge
                        variant={operations.restock.actionableProducts > 0 ? "warning" : "success"}
                      >
                        {operations.restock.actionableProducts > 0
                          ? `${operations.restock.actionableProducts} actionable`
                          : "No action needed"}
                      </StatusBadge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  {operationsLoading && !operations ? (
                    <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      Loading replenishment actions...
                    </div>
                  ) : operationsError && !operations ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {operationsError}
                    </div>
                  ) : operations && operations.restock.actions.length > 0 ? (
                    <div className="space-y-3">
                      {operations.restock.actions.map((action) => (
                        <div
                          className="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                          key={action.product.id}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-950">{action.product.name}</p>
                                <StatusBadge variant={riskVariant(action.riskLevel)}>
                                  {action.riskLevel}
                                </StatusBadge>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {action.product.sku} • {sourceLabel(action.recommendationSource)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Suggested
                              </p>
                              <p className="text-lg font-semibold text-slate-950">
                                {action.recommendedQuantity.toLocaleString()} units
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span>{action.sellableStock.toLocaleString()} sellable</span>
                            <span>{action.incomingStock.toLocaleString()} incoming</span>
                            {action.expiryRiskQuantity > 0 ? (
                              <span className="text-amber-700">
                                {action.expiryRiskQuantity.toLocaleString()} expiry-risk
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-600">{action.rationale}</p>
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <p className="text-xs text-slate-500">
                          {operations.restock.suggestedUnits.toLocaleString()} total suggested units across all current actions.
                        </p>
                        <Button onClick={() => onNavigate("/reports")} size="sm" type="button">
                          <ClipboardList className="h-4 w-4" />
                          Open restock planner
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
                      Current sellable and incoming stock cover the active replenishment policy.
                    </div>
                  )}

                  {operationsError && operations ? (
                    <p className="mt-3 text-xs text-amber-700">
                      Latest refresh warning: {operationsError}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>Restock pipeline</CardTitle>
                      <p className="mt-1 text-xs text-slate-500">
                        Order state only; inventory changes after receiving.
                      </p>
                    </div>
                    <Truck className="h-5 w-5 text-slate-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  {operations ? (
                    <div className="space-y-3">
                      <PipelineRow
                        label="Ready to receive"
                        value={operations.restock.queue.readyToReceive}
                        warning={operations.restock.queue.readyToReceive > 0}
                      />
                      <PipelineRow
                        label="Partially received"
                        value={operations.restock.queue.partiallyReceived}
                        warning={operations.restock.queue.partiallyReceived > 0}
                      />
                      <PipelineRow
                        label="Draft orders"
                        value={operations.restock.queue.draft}
                      />
                      <PipelineRow
                        label="Open pipeline"
                        value={operations.restock.queue.totalOpen}
                      />

                      {operations.restock.latestOpenOrder ? (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs text-slate-500">Latest open order</p>
                              <p className="mt-0.5 font-semibold text-slate-950">
                                {operations.restock.latestOpenOrder.orderNumber}
                              </p>
                            </div>
                            <StatusBadge
                              variant={orderStatusVariant(operations.restock.latestOpenOrder.status)}
                            >
                              {orderStatusLabel(operations.restock.latestOpenOrder.status)}
                            </StatusBadge>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {operations.restock.latestOpenOrder.productLines.toLocaleString()} product lines • {operations.restock.latestOpenOrder.remainingUnits.toLocaleString()} units remaining of {operations.restock.latestOpenOrder.requestedUnits.toLocaleString()}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {operations.restock.latestOpenOrder.automated
                              ? "Automated monthly restock batch"
                              : "Owner-created restock order"}
                            {" • "}
                            updated {dateTimeFormatter.format(new Date(operations.restock.latestOpenOrder.updatedAt))}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
                          No open restock orders.
                        </div>
                      )}

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        <Button onClick={() => onNavigate("/receiving")} size="sm" type="button">
                          <Truck className="h-4 w-4" />
                          Open receiving
                        </Button>
                        <Button
                          onClick={() => onNavigate("/reports")}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <ClipboardList className="h-4 w-4" />
                          Review restock
                        </Button>
                      </div>
                    </div>
                  ) : operationsLoading ? (
                    <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      Loading restock pipeline...
                    </div>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Restock pipeline is temporarily unavailable.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Retail activity</CardTitle>
                  <StatusBadge variant="info">Today</StatusBadge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid h-60 grid-cols-12 items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-4">
                  {summary.sales.activity.map((bucket) => {
                    const amount = Number(bucket.totalAmount);
                    const height =
                      amount > 0 ? Math.max(8, Math.round((amount / activityMax) * 100)) : 4;

                    return (
                      <div
                        aria-label={`${bucket.label}: ${formatCurrency(bucket.totalAmount)}`}
                        className={
                          amount > 0 ? "rounded-sm bg-emerald-600" : "rounded-sm bg-slate-200"
                        }
                        key={bucket.label}
                        style={{ height: `${height}%` }}
                        title={`${bucket.label}: ${formatCurrency(bucket.totalAmount)} • ${bucket.saleCount} sale${bucket.saleCount === 1 ? "" : "s"}`}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>System sync</CardTitle>
                  {summary.inventory.unlinkedCatalogItems > 0 ? (
                    <TriangleAlert className="h-5 w-5 text-amber-600" />
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {syncItems.map((item) => (
                    <div
                      className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                      key={item.label}
                    >
                      <span className="text-sm text-slate-700">{item.label}</span>
                      <StatusBadge variant={item.variant}>{item.value}</StatusBadge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}

function PipelineRow({
  label,
  value,
  warning = false
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
      <span className="text-sm text-slate-700">{label}</span>
      <span
        className={
          warning ? "text-sm font-semibold text-amber-700" : "text-sm font-semibold text-slate-950"
        }
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}
