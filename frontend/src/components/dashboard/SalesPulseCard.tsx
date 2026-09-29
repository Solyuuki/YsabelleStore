import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LineChart,
  Target
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchDashboardSalesCalendar,
  fetchDashboardSalesDay,
  saveDashboardSalesTarget,
  type DashboardSalesCalendar,
  type DashboardSalesDayDetail,
  type DashboardSummary
} from "@/services/dashboardApi";

const brandCardClass =
  "relative overflow-hidden border-slate-200/80 bg-white/90 shadow-[0_18px_40px_-30px_rgba(98,91,255,0.4)] backdrop-blur";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 1,
  notation: "compact",
  style: "currency"
});

const monthFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  timeZone: "UTC",
  year: "numeric"
});

const dayFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "full",
  timeZone: "UTC"
});

type SalesPulseCardProps = {
  isOwner: boolean;
  summary: DashboardSummary;
};

export function SalesPulseCard({ isOwner, summary }: SalesPulseCardProps) {
  const today = manilaDateKey(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<"calendar" | "activity">("calendar");
  const [calendar, setCalendar] = useState<DashboardSalesCalendar | null>(null);
  const [detail, setDetail] = useState<DashboardSalesDayDetail | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  async function loadCalendar(activeMonth = month) {
    setLoadingCalendar(true);
    try {
      const data = await fetchDashboardSalesCalendar(activeMonth);
      setCalendar(data);
      setError(null);
      if (!selectedDate.startsWith(activeMonth)) {
        setSelectedDate(today.startsWith(activeMonth) ? today : `${activeMonth}-01`);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load sales calendar.");
    } finally {
      setLoadingCalendar(false);
    }
  }

  useEffect(() => {
    void loadCalendar(month);
    // Calendar reloads when its visible month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    let active = true;
    setLoadingDetail(true);

    void fetchDashboardSalesDay(selectedDate)
      .then((data) => {
        if (!active) return;
        setDetail(data);
        setTargetInput(data.targetAmount ?? "");
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load sales day.");
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDate]);

  const firstWeekday = useMemo(() => {
    const first = calendar?.days[0]?.date;
    return first ? new Date(`${first}T00:00:00.000Z`).getUTCDay() : 0;
  }, [calendar]);

  const selectedCalendarDay = calendar?.days.find((day) => day.date === selectedDate) ?? null;
  const chartData = (detail?.activity ?? summary.sales.activity).map((bucket) => ({
    amount: Number(bucket.totalAmount),
    label: bucket.label,
    sales: bucket.saleCount
  }));

  async function saveTarget(value: number | null) {
    setSavingTarget(true);
    try {
      await saveDashboardSalesTarget(selectedDate, value);
      await Promise.all([loadCalendar(month), refreshDetail(selectedDate)]);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save sales target.");
    } finally {
      setSavingTarget(false);
    }
  }

  async function refreshDetail(date: string) {
    const data = await fetchDashboardSalesDay(date);
    setDetail(data);
    setTargetInput(data.targetAmount ?? "");
  }

  const selectedAmount = detail?.actualAmount ?? selectedCalendarDay?.actualAmount ?? "0.00";

  return (
    <Card className={brandCardClass}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#008cff] via-[#625bff] to-[#f43f8c]" />
      <CardHeader className="border-b border-slate-100 pb-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#625bff]">
              Sales pulse
            </p>
            <CardTitle className="mt-1">Retail activity</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Past actuals, today's progress, future targets, and monthly forecast context.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              className={tabClass(view === "calendar")}
              onClick={() => setView("calendar")}
              type="button"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </button>
            <button
              className={tabClass(view === "activity")}
              onClick={() => setView("activity")}
              type="button"
            >
              <LineChart className="h-3.5 w-3.5" />
              Activity chart
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {error ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {error}
          </div>
        ) : null}

        {view === "calendar" ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile label="Actual sales" value={formatCurrency(calendar?.summary.actualAmount ?? "0")} />
              <SummaryTile
                label="Target"
                value={
                  calendar?.summary.targetAmount
                    ? formatCurrency(calendar.summary.targetAmount)
                    : "Not set"
                }
                helper={
                  calendar?.summary.targetDays
                    ? `${calendar.summary.targetDays} targeted day${calendar.summary.targetDays === 1 ? "" : "s"}`
                    : "Set targets per business day"
                }
              />
              <SummaryTile
                label="Forecast"
                value={
                  calendar?.summary.forecastAmount
                    ? formatCurrency(calendar.summary.forecastAmount)
                    : "Unavailable"
                }
                helper={
                  calendar?.summary.forecastUnits !== null &&
                  calendar?.summary.forecastUnits !== undefined
                    ? `${calendar.summary.forecastUnits.toLocaleString()} forecast units · monthly estimate`
                    : "No forecast for this month"
                }
              />
              <SummaryTile
                label="Transactions"
                value={(calendar?.summary.completedSales ?? 0).toLocaleString()}
                helper={`${(calendar?.summary.unitsSold ?? 0).toLocaleString()} units sold`}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.55fr)]">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3 sm:px-4">
                  <div className="flex items-center gap-2">
                    <Button
                      aria-label="Previous month"
                      className="h-8 w-8 p-0"
                      onClick={() => setMonth(offsetMonth(month, -1))}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <p className="min-w-[150px] text-center text-sm font-semibold text-slate-900">
                      {formatMonth(month)}
                    </p>
                    <Button
                      aria-label="Next month"
                      className="h-8 w-8 p-0"
                      onClick={() => setMonth(offsetMonth(month, 1))}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      setMonth(today.slice(0, 7));
                      setSelectedDate(today);
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Today
                  </Button>
                </div>

                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
                    <div
                      className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs"
                      key={weekday}
                    >
                      {weekday}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {Array.from({ length: firstWeekday }).map((_, index) => (
                    <div
                      className="min-h-[78px] border-b border-r border-slate-100 bg-slate-50/30 sm:min-h-[96px]"
                      key={`empty-${index}`}
                    />
                  ))}
                  {calendar?.days.map((day) => {
                    const selected = day.date === selectedDate;
                    return (
                      <button
                        aria-label={`Open sales for ${day.date}`}
                        className={[
                          "group min-h-[78px] border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-[96px] sm:p-2.5",
                          selected ? "bg-violet-50 ring-2 ring-inset ring-[#625bff]" : "hover:bg-slate-50",
                          day.status === "TODAY" ? "relative" : ""
                        ].join(" ")}
                        key={day.date}
                        onClick={() => setSelectedDate(day.date)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={
                              day.status === "TODAY"
                                ? "flex h-6 w-6 items-center justify-center rounded-full bg-[#625bff] text-[11px] font-bold text-white"
                                : "text-xs font-semibold text-slate-700"
                            }
                          >
                            {Number(day.date.slice(-2))}
                          </span>
                          {day.targetAmount ? (
                            <Target className="h-3 w-3 text-[#625bff]" aria-hidden="true" />
                          ) : null}
                        </div>
                        <p className="mt-2 truncate text-[11px] font-semibold text-slate-900 sm:text-xs">
                          {day.status === "FUTURE"
                            ? day.targetAmount
                              ? compactCurrencyFormatter.format(Number(day.targetAmount))
                              : "No target"
                            : compactCurrencyFormatter.format(Number(day.actualAmount))}
                        </p>
                        <p className="mt-0.5 hidden text-[10px] text-slate-400 sm:block">
                          {day.status === "FUTURE"
                            ? day.targetAmount
                              ? "Target"
                              : "Future"
                            : `${day.completedSales} sale${day.completedSales === 1 ? "" : "s"}`}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {loadingCalendar ? (
                  <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                    Refreshing calendar…
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#625bff]">
                  Selected day
                </p>
                <h4 className="mt-1 text-base font-semibold text-slate-950">
                  {formatDay(selectedDate)}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  {detail?.status === "FUTURE"
                    ? "Future target planning"
                    : detail?.status === "TODAY"
                      ? "Live Manila business day"
                      : "Historical completed sales"}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniMetric label="Actual" value={formatCurrency(selectedAmount)} />
                  <MiniMetric
                    label="Target"
                    value={
                      detail?.targetAmount ? formatCurrency(detail.targetAmount) : "Not set"
                    }
                  />
                  <MiniMetric
                    label="Transactions"
                    value={(detail?.completedSales ?? 0).toLocaleString()}
                  />
                  <MiniMetric label="Units sold" value={(detail?.unitsSold ?? 0).toLocaleString()} />
                </div>

                {isOwner ? (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <label
                      className="text-xs font-semibold text-slate-700"
                      htmlFor="sales-target-amount"
                    >
                      Daily sales target
                    </label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="sales-target-amount"
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => setTargetInput(event.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={targetInput}
                      />
                      <Button
                        disabled={
                          savingTarget ||
                          targetInput.trim() === "" ||
                          !Number.isFinite(Number(targetInput)) ||
                          Number(targetInput) < 0
                        }
                        onClick={() => void saveTarget(Number(targetInput))}
                        size="sm"
                        type="button"
                      >
                        Save
                      </Button>
                    </div>
                    {detail?.targetAmount ? (
                      <Button
                        className="mt-2 px-0 text-xs"
                        disabled={savingTarget}
                        onClick={() => void saveTarget(null)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Clear target
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <Button
                  className="mt-5 w-full"
                  onClick={() => setView("activity")}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Activity className="h-4 w-4" />
                  View day activity
                </Button>
                {loadingDetail ? (
                  <p className="mt-3 text-xs text-slate-400">Loading day details…</p>
                ) : null}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Actuals come from completed POS sales. Targets are owner-managed per business day.
              Forecast is shown only at monthly resolution because the forecasting model produces monthly
              output; it is not artificially distributed across days.
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{formatDay(selectedDate)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Completed-sale revenue across 2-hour Manila windows.
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight text-slate-950">
                  {formatCurrency(selectedAmount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {(detail?.completedSales ?? 0).toLocaleString()} completed sales
                </p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart data={chartData} margin={{ bottom: 0, left: 0, right: 4, top: 8 }}>
                  <defs>
                    <linearGradient id="dashboardSalesAreaCalendar" x1="0" x2="0" y1="0" y2="1">
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
                    itemStyle={{ color: "#ffffff" }}
                    labelStyle={{ color: "#ffffff", fontWeight: 600, marginBottom: "4px" }}
                  />
                  <Area
                    dataKey="amount"
                    fill="url(#dashboardSalesAreaCalendar)"
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
                Completed-sale activity
              </span>
              <span>Manila business day</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  helper,
  label,
  value
}: {
  helper?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-950">{value}</p>
      {helper ? <p className="mt-1 text-[11px] text-slate-500">{helper}</p> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function tabClass(active: boolean) {
  return [
    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition",
    active ? "bg-white text-[#625bff] shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900"
  ].join(" ");
}

function formatCurrency(value: string | number) {
  return currencyFormatter.format(Number(value));
}

function formatMonth(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));
}

function formatDay(date: string) {
  return dayFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function offsetMonth(month: string, amount: number) {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function manilaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Manila",
    year: "numeric"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
