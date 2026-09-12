import {
  Boxes,
  CalendarClock,
  Download,
  PackageOpen,
  ReceiptText,
  RefreshCw,
  TriangleAlert
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis
} from "recharts";

import { ReportDownloadDialog } from "@/components/reports/ReportDownloadDialog";
import { RestockOrderHistoryPanel } from "@/components/reports/RestockOrderHistoryPanel";
import { RestockPlanningPanel } from "@/components/reports/RestockPlanningPanel";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDashboardSummary, type DashboardSummary } from "@/services/dashboardApi";
import { listRecentSales } from "@/services/posService";
import { listRestockOrders } from "@/services/restockApi";
import type { PosSale } from "@/types/pos";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const receiptTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  timeZone: "Asia/Manila"
});

const AVAILABILITY_COLORS = ["#4f46e5", "#e2e8f0"];

function currency(value: string | number) {
  return currencyFormatter.format(Number(value));
}

export function ReportsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [restockView, setRestockView] = useState<"plan" | "orders">("plan");
  const [restockOrderCount, setRestockOrderCount] = useState<number | null>(null);
  const [restockOrdersRefreshVersion, setRestockOrdersRefreshVersion] = useState(0);

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
  }, [refreshVersion]);

  useEffect(() => {
    let active = true;

    void listRestockOrders({ page: 1, pageSize: 1 })
      .then((result) => {
        if (active) setRestockOrderCount(result.meta.totalItems);
      })
      .catch(() => {
        if (active) setRestockOrderCount(null);
      });

    return () => {
      active = false;
    };
  }, [refreshVersion, restockOrdersRefreshVersion]);

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
  const recentReceiptChartData = useMemo(
    () =>
      completedSales
        .slice(0, 10)
        .reverse()
        .map((sale) => ({
          amount: Number(sale.totalAmount),
          label: receiptTimeFormatter.format(new Date(sale.saleDate)),
          receipt: sale.saleNumber,
          units: sale.itemCount
        })),
    [completedSales]
  );

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

  function notifyRestockOrdersChanged() {
    setRestockOrdersRefreshVersion((version) => version + 1);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Owner area"
        title="Reports"
        description="Live store overview with restock planning and separate downloadable reports for management, inventory, and suppliers."
        actions={
          <>
            <Button
              disabled={loading}
              onClick={() => setRefreshVersion((version) => version + 1)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
            <Button
              disabled={!summary || loading}
              onClick={() => setExportOpen(true)}
              size="sm"
              type="button"
            >
              <Download className="h-4 w-4" />
              Download report
            </Button>
          </>
        }
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

          <section className="space-y-3">
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Restock</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Plan a new restock or reopen persisted orders without mixing the two workflows.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  aria-pressed={restockView === "plan"}
                  onClick={() => setRestockView("plan")}
                  size="sm"
                  type="button"
                  variant={restockView === "plan" ? "default" : "secondary"}
                >
                  Plan restock
                </Button>
                <Button
                  aria-pressed={restockView === "orders"}
                  onClick={() => setRestockView("orders")}
                  size="sm"
                  type="button"
                  variant={restockView === "orders" ? "default" : "secondary"}
                >
                  Orders{restockOrderCount === null ? "" : ` (${restockOrderCount.toLocaleString()})`}
                </Button>
              </div>
            </div>

            {restockView === "plan" ? (
              <RestockPlanningPanel
                onOpenOrders={() => setRestockView("orders")}
                onOrdersChanged={notifyRestockOrdersChanged}
              />
            ) : (
              <RestockOrderHistoryPanel
                refreshVersion={refreshVersion + restockOrdersRefreshVersion}
              />
            )}
          </section>

          <section className="grid items-start gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Recent receipt metrics</CardTitle>
                  <StatusBadge variant={completedSales.length > 0 ? "success" : "info"}>
                    {completedSales.length > 0
                      ? `${completedSales.length.toLocaleString()} receipt${completedSales.length === 1 ? "" : "s"}`
                      : "No sales yet"}
                  </StatusBadge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-end">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Gross sales</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">
                      {currency(recentGrossSales)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                      <MiniMetric label="Units sold" value={recentUnits.toLocaleString()} />
                      <MiniMetric label="Average receipt" value={currency(averageReceipt)} />
                    </div>
                  </div>

                  {recentReceiptChartData.length >= 3 ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium text-slate-600">Recent sales trend</p>
                      <p className="text-[11px] text-slate-400">Gross value of recent receipts</p>
                      <div className="mt-2 h-28">
                        <ResponsiveContainer height="100%" width="100%">
                          <LineChart data={recentReceiptChartData} margin={{ bottom: 4, left: 4, right: 4, top: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" hide />
                            <Tooltip
                              formatter={(value) => [currency(Number(value)), "Gross sales"]}
                              labelFormatter={(label) => String(label)}
                            />
                            <Line
                              activeDot={{ r: 4 }}
                              dataKey="amount"
                              dot={{ r: 3 }}
                              stroke="#4f46e5"
                              strokeWidth={2}
                              type="monotone"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-xs leading-5 text-slate-500">
                      {completedSales.length === 0
                        ? "No completed receipts yet."
                        : `Complete ${3 - completedSales.length} more receipt${3 - completedSales.length === 1 ? "" : "s"} to unlock a useful sales trend.`}
                    </div>
                  )}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Based on recent completed receipts · Use Download report for printable or
                  spreadsheet copies.
                </p>
              </CardContent>
            </Card>

            <InventoryHealthCard summary={summary} />
          </section>
        </>
      ) : null}

      <ReportDownloadDialog
        completedSales={completedSales}
        onOpenChange={setExportOpen}
        open={exportOpen}
        summary={summary}
      />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function InventoryHealthCard({ summary }: { summary: DashboardSummary }) {
  const inventory = summary.inventory;
  const availabilityData = [
    { name: "Active", value: inventory.availableItems },
    { name: "Inactive", value: inventory.unavailableItems }
  ];
  const healthy = inventory.lowStockItems === 0 && inventory.outOfStockItems === 0;
  const healthSummary = healthy
    ? "No inventory issues need attention right now."
    : inventory.lowStockItems > 0 && inventory.outOfStockItems > 0
      ? "Low-stock and out-of-stock products need attention."
      : inventory.outOfStockItems > 0
        ? "Out-of-stock products need attention."
        : "Low-stock products need attention.";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Inventory health</CardTitle>
          <StatusBadge variant={healthy ? "success" : "warning"}>
            {healthy ? "Stock healthy" : "Needs attention"}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid items-center gap-4 sm:grid-cols-[120px_1fr]">
          <div className="mx-auto h-24 w-24">
            {inventory.catalogItems > 0 ? (
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={availabilityData}
                    dataKey="value"
                    innerRadius={28}
                    outerRadius={43}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {availabilityData.map((entry, index) => (
                      <Cell
                        fill={AVAILABILITY_COLORS[index]}
                        key={`${entry.name}-${entry.value}`}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-full border border-dashed border-slate-200 text-xs text-slate-400">
                No data
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <HealthValue label="Catalog" value={inventory.catalogItems} />
            <HealthValue label="Inventory records" value={inventory.trackedItems} />
            <HealthValue label="Active products" value={inventory.availableItems} />
            <HealthValue label="Inactive / stopped" value={inventory.unavailableItems} />
            <HealthValue label="Healthy stock" value={inventory.inStockItems} />
            <HealthValue
              label="Low / out"
              value={inventory.lowStockItems + inventory.outOfStockItems}
              warning={!healthy}
            />
          </div>
        </div>

        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {healthSummary}
        </p>
      </CardContent>
    </Card>
  );
}

function HealthValue({
  label,
  value,
  warning = false
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-slate-500">{label}</p>
      <p
        className={
          warning ? "text-lg font-semibold text-amber-700" : "text-lg font-semibold text-slate-950"
        }
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
