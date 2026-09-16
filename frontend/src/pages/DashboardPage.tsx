import {
  Activity,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Database,
  LineChart,
  ReceiptText,
  Sparkles,
  Truck,
  TriangleAlert,
  type LucideIcon
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis
} from "recharts";

import type { AppRoutePath } from "@/app/routes";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import {
  fetchDashboardOperations,
  fetchDashboardSummary,
  type DashboardOperations,
  type DashboardRestockAction,
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

const brandCardClass =
  "relative overflow-hidden border-slate-200/80 bg-white/90 shadow-[0_18px_40px_-30px_rgba(98,91,255,0.4)] backdrop-blur";

function formatCurrency(value: string | number) {
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
      if (intervalId !== null) window.clearInterval(intervalId);
      if (preferences.refreshDashboardOnFocus) {
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [isOwner, preferences.dashboardRefreshSeconds, preferences.refreshDashboardOnFocus]);

  const forecastStat = summary
    ? summary.forecast.access === "AVAILABLE"
      ? {
          value: `${summary.forecast.forecastUnits2026.toLocaleString()} units`,
          detail: `${summary.forecast.totalProductsForecasted} products forecasted`
        }
      : summary.forecast.access === "RESTRICTED"
        ? { value: "Protected", detail: "Owner verification required" }
        : { value: "Unavailable", detail: "Forecast is not ready" }
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          summary ? (
            <div className="flex items-center gap-2 rounded-full border border-[#625bff]/15 bg-white/85 px-3 py-2 shadow-sm backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#625bff] opacity-35" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#625bff]" />
              </span>
              <span className="text-xs font-semibold text-slate-700">Live</span>
              <span className="hidden text-xs text-slate-400 md:inline">•</span>
              <span className="hidden text-xs text-slate-500 md:inline">
                {dateTimeFormatter.format(new Date(summary.generatedAt))}
              </span>
            </div>
          ) : null
        }
        eyebrow="Store command center"
        title="Dashboard"
        description="A focused operating view for sales, inventory health, replenishment, receiving, expiry, and forecast signals."
      />

      {loading && !summary ? (
        <LoadingState
          badge="Synchronizing"
          label="Loading live store operations"
          helper="Sales, inventory, expiry, and forecast status are being read from the current database."
        />
      ) : null}

      {error ? (
        <Card className="border-amber-200/80 bg-amber-50/80 shadow-none">
          <CardContent className="py-4 text-sm text-amber-800">{error}</CardContent>
        </Card>
      ) : null}

      {summary ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              detail={formatCount(summary.sales.completedSales, "completed sale")}
              icon={ReceiptText}
              label="Today's sales"
              value={formatCurrency(summary.sales.todayAmount)}
            />
            <MetricCard
              detail={`${summary.inventory.availableItems} available • ${summary.inventory.unavailableItems} unavailable`}
              icon={Boxes}
              label="Inventory"
              value={formatCount(summary.inventory.trackedItems, "item")}
            />
            <AlertMetricCard summary={summary} />
            <MetricCard
              detail={forecastStat?.detail ?? "Forecast is not ready"}
              icon={LineChart}
              label="Forecast"
              value={forecastStat?.value ?? "Unavailable"}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
            <SalesActivityCard summary={summary} />
            {isOwner ? (
              <RestockPipelineCard
                loading={operationsLoading}
                onNavigate={onNavigate}
                operations={operations}
              />
            ) : (
              <SystemSyncCard summary={summary} />
            )}
          </section>

          {isOwner ? (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
              <RestockActionsCard
                error={operationsError}
                loading={operationsLoading}
                onNavigate={onNavigate}
                operations={operations}
              />
              <SystemSyncCard summary={summary} />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

type MetricCardProps = {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: string;
};

function BrandAccent() {
  return (
    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#008cff] via-[#625bff] to-[#f43f8c]" />
  );
}

function BrandIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#008cff] via-[#625bff] to-[#f43f8c] text-white shadow-sm shadow-[#625bff]/20">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function MetricCard({ detail, icon, label, value }: MetricCardProps) {
  return (
    <Card className={brandCardClass}>
      <BrandAccent />
      <CardContent className="flex min-h-40 flex-col justify-between p-5 pt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          <BrandIcon icon={icon} />
        </div>
        <div className="mt-7">
          <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertMetricCard({ summary }: { summary: DashboardSummary }) {
  const alertCount =
    summary.inventory.lowStockItems +
    summary.inventory.outOfStockItems +
    summary.expiry.nearExpiryBatches +
    summary.expiry.expiredBatches;

  return (
    <Card className={brandCardClass}>
      <BrandAccent />
      <CardContent className="flex min-h-40 flex-col justify-between p-5 pt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">Stock alerts</p>
          {alertCount > 0 ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            </span>
          ) : (
            <BrandIcon icon={CheckCircle2} />
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 divide-x divide-slate-100">
          <div className="pr-4">
            <p className="text-2xl font-semibold tracking-tight text-slate-950">
              {summary.inventory.lowStockItems}
            </p>
            <p className="mt-1 text-xs text-slate-500">Low stock</p>
          </div>
          <div className="pl-4">
            <p className="text-2xl font-semibold tracking-tight text-slate-950">
              {summary.expiry.nearExpiryBatches}
            </p>
            <p className="mt-1 text-xs text-slate-500">Near expiry</p>
          </div>
        </div>
        <p className="mt-3 text-xs font-medium text-slate-500">
          {alertCount === 0
            ? "No immediate stock exceptions"
            : `${alertCount.toLocaleString()} total inventory exceptions`}
        </p>
      </CardContent>
    </Card>
  );
}

function SalesActivityCard({ summary }: { summary: DashboardSummary }) {
  const chartData = summary.sales.activity.map((bucket) => ({
    amount: Number(bucket.totalAmount),
    label: bucket.label,
    sales: bucket.saleCount
  }));

  return (
    <Card className={brandCardClass}>
      <BrandAccent />
      <CardHeader className="border-b border-slate-100 pb-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#625bff]">
              Sales pulse
            </p>
            <CardTitle className="mt-1">Retail activity</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Revenue movement across today's 2-hour windows.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-slate-950">
              {formatCurrency(summary.sales.todayAmount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatCount(summary.sales.completedSales, "completed sale")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="h-64 w-full">
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart data={chartData} margin={{ bottom: 0, left: 0, right: 4, top: 8 }}>
              <defs>
                <linearGradient id="dashboardSalesArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#625bff" stopOpacity={0.3} />
                  <stop offset="65%" stopColor="#008cff" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#f43f8c" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 6" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                interval={1}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#514bcf",
                  border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: "10px",
                  boxShadow: "0 18px 40px -18px rgba(98,91,255,0.65)",
                  color: "#fff",
                  fontSize: "12px"
                }}
                cursor={{ stroke: "#c4b5fd", strokeDasharray: "4 4" }}
                formatter={(value) => [formatCurrency(Number(value)), "Sales"]}
                labelStyle={{ color: "#ede9fe", marginBottom: "4px" }}
              />
              <Area
                dataKey="amount"
                fill="url(#dashboardSalesArea)"
                fillOpacity={1}
                stroke="#625bff"
                strokeWidth={2.5}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#625bff]" aria-hidden="true" />
            Live completed-sale activity
          </span>
          <span>Manila business day</span>
        </div>
      </CardContent>
    </Card>
  );
}

type OwnerOperationsProps = {
  error: string | null;
  loading: boolean;
  onNavigate: (path: AppRoutePath) => void;
  operations: DashboardOperations | null;
};

function RestockActionsCard({
  error,
  loading,
  onNavigate,
  operations
}: OwnerOperationsProps) {
  return (
    <Card className={brandCardClass}>
      <BrandAccent />
      <CardHeader className="border-b border-slate-100 pb-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#625bff]">
              Action center
            </p>
            <CardTitle className="mt-1">Needs attention</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Restock decisions ranked from the existing replenishment policy.
            </p>
          </div>
          {operations ? (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                operations.restock.actionableProducts > 0
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                  : "bg-violet-50 text-[#625bff] ring-1 ring-violet-200"
              }`}
            >
              {operations.restock.actionableProducts > 0
                ? `${operations.restock.actionableProducts} actionable`
                : "All clear"}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {loading && !operations ? (
          <DashboardPanelLoading label="Loading replenishment actions..." />
        ) : error && !operations ? (
          <DashboardPanelError message={error} />
        ) : operations && operations.restock.actions.length > 0 ? (
          <div className="space-y-3">
            {operations.restock.actions.map((action) => (
              <RestockActionCard action={action} key={action.product.id} />
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                {operations.restock.suggestedUnits.toLocaleString()} total suggested units across the
                active queue.
              </p>
              <Button onClick={() => onNavigate("/reports")} size="sm" type="button">
                <ClipboardList className="h-4 w-4" />
                Open restock planner
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-36 flex-col justify-between gap-5 rounded-xl border border-dashed border-violet-200 bg-gradient-to-br from-[#008cff]/[0.06] via-[#625bff]/[0.06] to-[#f43f8c]/[0.05] p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <BrandIcon icon={Sparkles} />
              <div>
                <p className="font-semibold text-slate-950">Inventory coverage looks healthy</p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
                  Current sellable and incoming stock cover the active replenishment policy. No owner
                  intervention is required right now.
                </p>
              </div>
            </div>
            <Button
              onClick={() => onNavigate("/reports")}
              size="sm"
              type="button"
              variant="secondary"
            >
              Review planner
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {error && operations ? (
          <p className="mt-3 text-xs text-amber-700">Latest refresh warning: {error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RestockActionCard({ action }: { action: DashboardRestockAction }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-950">{action.product.name}</p>
            <StatusBadge variant={riskVariant(action.riskLevel)}>{action.riskLevel}</StatusBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {action.product.sku} • {sourceLabel(action.recommendationSource)}
          </p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2 text-right ring-1 ring-violet-100">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#625bff]">
            Suggested
          </p>
          <p className="mt-0.5 text-lg font-semibold text-slate-950">
            {action.recommendedQuantity.toLocaleString()} units
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
          {action.sellableStock.toLocaleString()} sellable
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
          {action.incomingStock.toLocaleString()} incoming
        </span>
        {action.expiryRiskQuantity > 0 ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200">
            {action.expiryRiskQuantity.toLocaleString()} expiry-risk
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">{action.rationale}</p>
    </div>
  );
}

function RestockPipelineCard({
  loading,
  onNavigate,
  operations
}: Omit<OwnerOperationsProps, "error">) {
  return (
    <Card className={brandCardClass}>
      <BrandAccent />
      <CardHeader className="border-b border-slate-100 pb-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#625bff]">
              Procurement
            </p>
            <CardTitle className="mt-1">Restock pipeline</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Inventory changes only after receiving.</p>
          </div>
          <BrandIcon icon={Truck} />
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {operations ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <PipelineStat
                label="Ready"
                tone="warning"
                value={operations.restock.queue.readyToReceive}
              />
              <PipelineStat
                label="Partial"
                tone={operations.restock.queue.partiallyReceived > 0 ? "warning" : "neutral"}
                value={operations.restock.queue.partiallyReceived}
              />
              <PipelineStat label="Drafts" value={operations.restock.queue.draft} />
              <PipelineStat label="Open" value={operations.restock.queue.totalOpen} />
            </div>
            {operations.restock.latestOpenOrder ? (
              <LatestRestockOrder order={operations.restock.latestOpenOrder} />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-xs text-slate-500">
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
        ) : loading ? (
          <DashboardPanelLoading label="Loading restock pipeline..." />
        ) : (
          <DashboardPanelError message="Restock pipeline is temporarily unavailable." />
        )}
      </CardContent>
    </Card>
  );
}

type LatestRestockOrderProps = {
  order: NonNullable<DashboardOperations["restock"]["latestOpenOrder"]>;
};

function LatestRestockOrder({ order }: LatestRestockOrderProps) {
  const completion =
    order.requestedUnits > 0
      ? Math.min(100, Math.round((order.receivedUnits / order.requestedUnits) * 100))
      : 0;

  return (
    <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#625bff]">
            Latest open order
          </p>
          <p className="mt-1 truncate font-semibold text-slate-950">{order.orderNumber}</p>
        </div>
        <StatusBadge variant={orderStatusVariant(order.status)}>
          {orderStatusLabel(order.status)}
        </StatusBadge>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#008cff] via-[#625bff] to-[#f43f8c] transition-[width]"
          style={{ width: `${completion}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{completion}% received</span>
        <span>{order.remainingUnits.toLocaleString()} units remaining</span>
      </div>
      <div className="mt-4 border-t border-violet-100 pt-3 text-[11px] leading-5 text-slate-500">
        <p>
          {order.productLines.toLocaleString()} product lines • {order.requestedUnits.toLocaleString()}
          {" requested units"}
        </p>
        <p>
          {order.automated ? "Automated monthly restock batch" : "Owner-created restock order"}
          {" • updated "}
          {dateTimeFormatter.format(new Date(order.updatedAt))}
        </p>
      </div>
    </div>
  );
}

function PipelineStat({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: "neutral" | "warning";
  value: number;
}) {
  const warning = tone === "warning" && value > 0;

  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        warning ? "border-amber-200 bg-amber-50/70" : "border-violet-100 bg-violet-50/40"
      }`}
    >
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tracking-tight ${
          warning ? "text-amber-700" : "text-slate-950"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function SystemSyncCard({ summary }: { summary: DashboardSummary }) {
  const synced = summary.inventory.unlinkedCatalogItems === 0;

  return (
    <Card className={brandCardClass}>
      <BrandAccent />
      <CardHeader className="border-b border-slate-100 pb-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#625bff]">
              Data integrity
            </p>
            <CardTitle className="mt-1">System sync</CardTitle>
          </div>
          {synced ? (
            <BrandIcon icon={CheckCircle2} />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        <div
          className={`flex items-center justify-between rounded-xl border px-3.5 py-3 ${
            synced
              ? "border-violet-100 bg-violet-50/40"
              : "border-amber-200 bg-amber-50/60"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-[#625bff]" aria-hidden="true" />
            <span className="text-sm font-medium text-slate-700">Catalog → inventory</span>
          </div>
          <span
            className={`text-xs font-semibold ${synced ? "text-[#625bff]" : "text-amber-700"}`}
          >
            {synced ? "Synced" : `${summary.inventory.unlinkedCatalogItems} missing`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <SyncMetric label="Catalog" value={summary.inventory.catalogItems} />
          <SyncMetric label="Inventory" value={summary.inventory.trackedItems} />
          <SyncMetric label="Available" value={summary.inventory.availableItems} />
          <SyncMetric label="Sales today" value={summary.sales.completedSales} />
        </div>
      </CardContent>
    </Card>
  );
}

function SyncMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/35 px-3 py-3">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function DashboardPanelLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-violet-200 bg-violet-50/35 px-4 py-8 text-center text-sm text-slate-500">
      <span className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 animate-pulse text-[#625bff]" aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}

function DashboardPanelError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
      {message}
    </div>
  );
}
