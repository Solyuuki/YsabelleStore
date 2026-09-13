import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

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
  listRestockPlanning,
  type RestockForecastRisk,
  type RestockPlanningCandidate
} from "@/services/restockApi";

const RISK_PRIORITY: Record<RestockForecastRisk, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
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

function riskVariant(risk: RestockForecastRisk | null | undefined) {
  if (risk === "CRITICAL" || risk === "HIGH") return "danger" as const;
  if (risk === "MEDIUM") return "warning" as const;
  if (risk === "LOW") return "success" as const;
  return "default" as const;
}

function stockStatusLabel(candidate: RestockPlanningCandidate) {
  if (candidate.recommendedQuantity <= 0) return "Stock OK";

  switch (candidate.forecastDecision?.riskLevel) {
    case "CRITICAL":
      return "Urgent";
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    case "LOW":
      return "Low";
    default:
      return "Needs review";
  }
}

function sourceLabel(candidate: RestockPlanningCandidate) {
  if (candidate.recommendationSource === "SARIMA") return candidate.forecast?.modelName ?? "SARIMA";
  if (candidate.recommendationSource === "LOW_STOCK") return "Low stock";
  return "Stock policy";
}

function buildDemandChart(candidate: RestockPlanningCandidate | null) {
  if (!candidate?.forecast) return [];

  const historical = candidate.forecast.historical.slice(-12).map((point) => ({
    actual: point.quantitySold,
    confidenceBase: null,
    confidenceRange: null,
    forecast: null,
    label: formatMonth(point.period),
    period: point.period
  }));
  const forecast = candidate.forecast.points.map((point) => {
    const lower = point.lowerConfidence;
    const upper = point.upperConfidence;
    return {
      actual: null,
      confidenceBase: lower,
      confidenceRange: lower !== null && upper !== null ? Math.max(0, upper - lower) : null,
      forecast: point.predictedQuantity,
      label: formatMonth(point.period),
      period: point.period
    };
  });

  return [...historical, ...forecast];
}

function buildInventoryProjection(candidate: RestockPlanningCandidate | null) {
  if (!candidate?.forecast) return [];

  let projected = Math.max(
    0,
    candidate.sellableStock + candidate.incomingStock - candidate.expiryRiskQuantity
  );
  const points = [
    {
      label: "Now",
      period: "now",
      projectedStock: projected
    }
  ];

  for (const point of candidate.forecast.points) {
    projected -= Math.max(0, point.predictedQuantity);
    points.push({
      label: formatMonth(point.period),
      period: point.period,
      projectedStock: projected
    });
  }

  return points;
}

export function RestockForecastPanel({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [items, setItems] = useState<RestockPlanningCandidate[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localRefreshVersion, setLocalRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await listRestockPlanning(
          { includeZero: true, page: 1, pageSize: 100 },
          { signal: controller.signal }
        );
        if (!active) return;

        const sorted = [...result.items].sort((left, right) => {
          const leftRisk = left.forecastDecision?.riskLevel ?? "LOW";
          const rightRisk = right.forecastDecision?.riskLevel ?? "LOW";
          const riskDifference = RISK_PRIORITY[rightRisk] - RISK_PRIORITY[leftRisk];
          if (riskDifference !== 0) return riskDifference;
          return right.recommendedQuantity - left.recommendedQuantity;
        });

        setItems(sorted);
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
            : "Forecast-driven restock recommendations could not be loaded."
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

  const selected = useMemo(
    () => items.find((item) => item.product.id === selectedProductId) ?? null,
    [items, selectedProductId]
  );
  const actionableItems = useMemo(
    () => items.filter((item) => item.recommendedQuantity > 0),
    [items]
  );
  const demandChart = useMemo(() => buildDemandChart(selected), [selected]);
  const inventoryProjection = useMemo(() => buildInventoryProjection(selected), [selected]);
  const firstForecastPeriod = selected?.forecast?.points[0]?.period ?? null;
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

  if (loading && items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingState
            badge="Forecast"
            helper="Reading persisted demand forecasts and current stock position."
            label="Preparing restock intelligence"
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
              Automatic SARIMAX-driven demand intelligence stays visible even when current stock
              does not require a restock. Manual custom restocking stays in the separate Restock
              planner.
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
          <ForecastMetric label="Needs action" value={summary.actionCount} />
          <ForecastMetric label="High risk" value={summary.highRisk} />
          <ForecastMetric label="Stockout within 7d" value={summary.sevenDayStockouts} />
          <ForecastMetric label="Suggested units" value={summary.units} />
        </div>

        {summary.actionCount === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-950">No restock action required</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Current sellable and incoming stock cover the active forecast demand. Forecast charts
              remain available below for monitoring.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-950">Forecast watchlist</p>
              <p className="mt-1 text-xs text-slate-500">
                Forecast-ready products stay visible here even when suggested restock is zero.
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
                      <TableHead className="text-right">Suggested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.slice(0, 12).map((item) => {
                      const selectedRow = item.product.id === selectedProductId;
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
                            <Badge variant={riskVariant(item.forecastDecision?.riskLevel)}>
                              {stockStatusLabel(item)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(item.sellableStock)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-950">
                            {formatNumber(item.recommendedQuantity)}
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
                    The chart workspace remains ready while forecast history is being built.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {selected?.product.name ?? "Demand forecast"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selected?.forecast
                    ? `${selected.forecast.modelName ?? "SARIMA"} demand forecast · Generated ${formatDate(selected.forecast.generatedAt)}`
                    : "Historical demand, forecast trajectory, and confidence interval."}
                </p>
              </div>
              {selected ? (
                <Badge variant={riskVariant(selected.forecastDecision?.riskLevel)}>
                  {stockStatusLabel(selected)}
                </Badge>
              ) : null}
            </div>

            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ForecastMetric
                  compact
                  label="30d demand"
                  value={Math.ceil(
                    selected?.forecastDecision?.currentMonthDemand ??
                      selected?.forecast?.currentMonthDemand ??
                      0
                  )}
                />
                <ForecastMetric compact label="Incoming" value={selected?.incomingStock ?? 0} />
                <ForecastMetric
                  compact
                  label="Stockout"
                  value={formatDate(selected?.forecastDecision?.projectedStockoutDate)}
                />
                <ForecastMetric
                  compact
                  label="Action date"
                  value={formatDate(selected?.forecastDecision?.recommendedActionDate)}
                />
              </div>

              <div>
                <div className="mb-2">
                  <p className="text-sm font-semibold text-slate-950">Demand forecast</p>
                  <p className="text-xs text-slate-500">
                    Historical demand, SARIMAX forecast, and confidence interval.
                  </p>
                </div>
                <div className="relative h-64 rounded-md border border-slate-200 bg-white p-2">
                  {demandChart.length > 0 ? (
                    <ResponsiveContainer height="100%" width="100%">
                      <ComposedChart
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
                        <Area
                          dataKey="confidenceBase"
                          fill="transparent"
                          name="Confidence lower"
                          stackId="confidence"
                          stroke="none"
                        />
                        <Area
                          dataKey="confidenceRange"
                          fill="#818cf8"
                          fillOpacity={0.18}
                          name="Confidence interval"
                          stackId="confidence"
                          stroke="none"
                        />
                        <Line
                          connectNulls={false}
                          dataKey="actual"
                          dot={false}
                          name="Historical demand"
                          stroke="#475569"
                          strokeWidth={2}
                          type="monotone"
                        />
                        <Line
                          connectNulls={false}
                          dataKey="forecast"
                          dot={{ r: 2.5 }}
                          name="Forecast demand"
                          stroke="#4f46e5"
                          strokeWidth={2.5}
                          type="monotone"
                        />
                        {firstForecastPeriod ? (
                          <ReferenceLine
                            label={{ fill: "#64748b", fontSize: 10, value: "Forecast" }}
                            stroke="#94a3b8"
                            strokeDasharray="4 4"
                            x={formatMonth(firstForecastPeriod)}
                          />
                        ) : null}
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Forecast chart ready</p>
                        <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                          No SARIMAX series is available yet. This chart area remains visible and
                          will populate automatically when forecast history is generated.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {inventoryProjection.length > 1 && selected ? (
                <div>
                  <div className="mb-2">
                    <p className="text-sm font-semibold text-slate-950">Projected inventory</p>
                    <p className="text-xs text-slate-500">
                      Sellable + incoming stock, less expiry exposure and forecast demand.
                    </p>
                  </div>
                  <div className="h-44 rounded-md border border-slate-200 bg-slate-50/40 p-2">
                    <ResponsiveContainer height="100%" width="100%">
                      <LineChart
                        data={inventoryProjection}
                        margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" minTickGap={18} tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={38} />
                        <Tooltip
                          formatter={(value) => [formatNumber(Number(value), 1), "Projected stock"]}
                        />
                        <ReferenceLine
                          label={{ fill: "#64748b", fontSize: 10, value: "Target" }}
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          y={selected.product.targetStockLevel}
                        />
                        <ReferenceLine
                          label={{ fill: "#b45309", fontSize: 10, value: "Reorder" }}
                          stroke="#d97706"
                          strokeDasharray="4 4"
                          y={selected.product.reorderLevel}
                        />
                        <ReferenceLine stroke="#dc2626" y={0} />
                        <Line
                          dataKey="projectedStock"
                          dot={{ r: 2.5 }}
                          name="Projected stock"
                          stroke="#0f766e"
                          strokeWidth={2.5}
                          type="monotone"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              {selected ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Forecast interpretation
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{selected.rationale}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                    <span>Sellable {formatNumber(selected.sellableStock)}</span>
                    <span>Incoming {formatNumber(selected.incomingStock)}</span>
                    <span>Expiry exposure {formatNumber(selected.expiryRiskQuantity)}</span>
                    <span>Target {formatNumber(selected.product.targetStockLevel)}</span>
                    <span>Reorder {formatNumber(selected.product.reorderLevel)}</span>
                  </div>
                </div>
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
