import { Boxes, ChartNoAxesCombined, LineChart, PackageOpen, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDashboardSummary, type DashboardSummary } from "@/services/dashboardApi";
import { getWorkstationPreferences } from "@/services/workstationPreferences";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

function formatCurrency(value: string) {
  return currencyFormatter.format(Number(value));
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences] = useState(getWorkstationPreferences);

  useEffect(() => {
    let active = true;

    async function loadSummary(initial = false) {
      if (initial) setLoading(true);

      try {
        const result = await fetchDashboardSummary();
        if (!active) return;
        setSummary(result);
        setError(null);
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError instanceof Error ? requestError.message : "Unable to load dashboard summary."
        );
      } finally {
        if (active && initial) setLoading(false);
      }
    }

    void loadSummary(true);
    const intervalId =
      preferences.dashboardRefreshSeconds > 0
        ? window.setInterval(
            () => void loadSummary(false),
            preferences.dashboardRefreshSeconds * 1000
          )
        : null;
    const handleFocus = () => void loadSummary(false);

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
  }, [preferences.dashboardRefreshSeconds, preferences.refreshDashboardOnFocus]);

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
              ? `${summary.inventory.availableItems} available • ${summary.inventory.unavailableItems} unavailable`
              : `${summary.inventory.unlinkedCatalogItems} catalog items need linking`,
          tone:
            summary.inventory.unlinkedCatalogItems === 0
              ? ("success" as const)
              : ("warning" as const),
          icon: Boxes
        },
        {
          title: "Low Stock",
          value: formatCount(summary.inventory.lowStockItems, "item"),
          detail: summary.inventory.lowStockItems > 0 ? "Needs replenishment" : "No items flagged",
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
        description="A quick operating view for sales, stock, expiry attention, and forecast access."
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
          <section className="grid gap-4 xl:grid-cols-5 lg:grid-cols-3">
            {dashboardStats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </section>

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
                <CardTitle>System sync</CardTitle>
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
