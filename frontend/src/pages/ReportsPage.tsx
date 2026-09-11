import { Boxes, CalendarClock, PackageOpen, ReceiptText, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RestockPlanningPanel } from "@/components/reports/RestockPlanningPanel";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDashboardSummary, type DashboardSummary } from "@/services/dashboardApi";
import { listRecentSales } from "@/services/posService";
import type { PosSale } from "@/types/pos";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

function currency(value: string | number) {
  return currencyFormatter.format(Number(value));
}

export function ReportsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      setLoading(true);
      setError(null);

      try {
        const [dashboardResult, salesResult] = await Promise.all([
          fetchDashboardSummary(),
          listRecentSales(50)
        ]);

        if (!active) return;

        setSummary(dashboardResult);
        if (!salesResult.success || !salesResult.data) {
          setSales([]);
          setError(salesResult.message || "Recent sales could not be loaded.");
        } else {
          setSales(salesResult.data.sales);
        }
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Operational reports could not be loaded."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadReport();
    return () => {
      active = false;
    };
  }, []);

  const completedSales = useMemo(
    () => sales.filter((sale) => sale.status === "COMPLETED"),
    [sales]
  );
  const recentGrossSales = useMemo(
    () => completedSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0),
    [completedSales]
  );
  const recentUnits = useMemo(
    () => completedSales.reduce((sum, sale) => sum + sale.itemCount, 0),
    [completedSales]
  );
  const averageReceipt = completedSales.length > 0 ? recentGrossSales / completedSales.length : 0;

  const stats = summary
    ? [
        {
          title: "Today's sales",
          value: currency(summary.sales.todayAmount),
          detail: `${summary.sales.completedSales} completed receipt${summary.sales.completedSales === 1 ? "" : "s"}`,
          tone: "info" as const,
          icon: ReceiptText
        },
        {
          title: "Recent gross",
          value: currency(recentGrossSales),
          detail: `Across ${completedSales.length} completed receipt${completedSales.length === 1 ? "" : "s"} in the latest 50 records`,
          tone: "success" as const,
          icon: CalendarClock
        },
        {
          title: "Tracked inventory",
          value: summary.inventory.trackedItems.toLocaleString(),
          detail: `${summary.inventory.inStockItems} in stock • ${summary.inventory.outOfStockItems} out of stock`,
          tone: summary.inventory.outOfStockItems > 0 ? ("warning" as const) : ("success" as const),
          icon: Boxes
        },
        {
          title: "Low stock",
          value: summary.inventory.lowStockItems.toLocaleString(),
          detail:
            summary.inventory.lowStockItems > 0
              ? "Needs replenishment attention"
              : "No items flagged",
          tone: "warning" as const,
          icon: PackageOpen
        },
        {
          title: "Expiry attention",
          value: summary.expiry.nearExpiryBatches.toLocaleString(),
          detail: `${summary.expiry.expiredBatches} expired batch${summary.expiry.expiredBatches === 1 ? "" : "es"}`,
          tone: "warning" as const,
          icon: TriangleAlert
        }
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Owner area"
        title="Reports"
        description="A quick operational view of sales, stock health, and expiry attention. Restock actions are grouped separately below so the report stays easy to scan."
      />

      {loading && !summary ? (
        <LoadingState
          badge="Loading"
          helper="Reading sales, inventory, and expiry data from the live backend."
          label="Building operational report"
        />
      ) : null}

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
            <Card>
              <CardHeader>
                <CardTitle>Recent receipt metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <MetricRow
                  label="Completed receipts analyzed"
                  value={completedSales.length.toLocaleString()}
                />
                <MetricRow label="Units sold" value={recentUnits.toLocaleString()} />
                <MetricRow label="Gross sales" value={currency(recentGrossSales)} />
                <MetricRow label="Average receipt" value={currency(averageReceipt)} />
                <p className="pt-2 text-xs leading-5 text-slate-500">
                  Metrics include completed sales only and use up to the latest 50 persisted sale
                  records. This is an operational view, not a full accounting-period statement.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Inventory health</CardTitle>
                  <StatusBadge
                    variant={summary.inventory.unlinkedCatalogItems === 0 ? "success" : "warning"}
                  >
                    {summary.inventory.unlinkedCatalogItems === 0
                      ? "Catalog linked"
                      : `${summary.inventory.unlinkedCatalogItems} unlinked`}
                  </StatusBadge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <HealthTile label="Catalog products" value={summary.inventory.catalogItems} />
                  <HealthTile label="Inventory records" value={summary.inventory.trackedItems} />
                  <HealthTile label="Available products" value={summary.inventory.availableItems} />
                  <HealthTile
                    label="Unavailable products"
                    value={summary.inventory.unavailableItems}
                  />
                  <HealthTile label="In stock" value={summary.inventory.inStockItems} />
                  <HealthTile label="Out of stock" value={summary.inventory.outOfStockItems} />
                </div>
              </CardContent>
            </Card>
          </section>

          <RestockPlanningPanel />
        </>
      ) : null}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function HealthTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value.toLocaleString()}</p>
    </div>
  );
}
