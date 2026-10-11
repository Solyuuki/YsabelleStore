import { CalendarDays, ChevronLeft, ChevronRight, LineChart, Target } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchDashboardSalesCalendar,
  fetchDashboardSalesDay,
  type DashboardSalesCalendar,
  type DashboardSalesCalendarDay,
  type DashboardSalesDayDetail,
  type DashboardSummary
} from "@/services/dashboardApi";

const SALES_CALENDAR_MIN_MONTH = "2019-01";

const brandCardClass =
  "ys-dashboard-panel-surface relative overflow-hidden border-slate-200/80 bg-white/90 shadow-[0_18px_40px_-30px_rgba(98,91,255,0.4)] backdrop-blur";

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
  const [view, setView] = useState<"calendar" | "performance">("calendar");
  const [calendar, setCalendar] = useState<DashboardSalesCalendar | null>(null);
  const [detail, setDetail] = useState<DashboardSalesDayDetail | null>(null);
  const [, setLoadingCalendar] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSummaryGeneratedAt = useRef(summary.generatedAt);

  async function loadCalendar(activeMonth = month) {
    setLoadingCalendar(true);
    setCalendar((current) => (current?.month === activeMonth ? current : null));
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
  }, [month]);

  useEffect(() => {
    let active = true;
    setLoadingDetail(true);
    setDetail(null);

    void fetchDashboardSalesDay(selectedDate)
      .then((data) => {
        if (!active) return;
        setDetail(data);
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

  useEffect(() => {
    if (lastSummaryGeneratedAt.current === summary.generatedAt) return;
    lastSummaryGeneratedAt.current = summary.generatedAt;

    if (month === today.slice(0, 7)) {
      void loadCalendar(month);
    }
    if (selectedDate === today) {
      void refreshDetail(selectedDate);
    }
  }, [month, selectedDate, summary.generatedAt, today]);

  const firstWeekday = useMemo(() => {
    const first = calendar?.days[0]?.date;
    return first ? new Date(`${first}T00:00:00.000Z`).getUTCDay() : 0;
  }, [calendar]);

  const selectedCalendarDay = calendar?.days.find((day) => day.date === selectedDate) ?? null;
  const trailingDays = calendar ? (7 - ((firstWeekday + calendar.days.length) % 7)) % 7 : 0;
  const chartData = (detail?.activity ?? []).map((bucket) => ({
    amount: Number(bucket.totalAmount),
    label: bucket.label,
    sales: bucket.saleCount
  }));
  const monthlyPerformanceData = (calendar?.days ?? []).map((day) => ({
    actual: day.actualDataAvailable ? Number(day.actualAmount) : null,
    label: String(Number(day.date.slice(-2))),
    target: day.targetAmount ? Number(day.targetAmount) : null
  }));

  async function refreshDetail(date: string) {
    const data = await fetchDashboardSalesDay(date);
    setDetail(data);
  }

  const selectedAmount = detail?.actualAmount ?? selectedCalendarDay?.actualAmount ?? "0.00";
  const selectedActualAvailable =
    detail?.actualDataAvailable ?? selectedCalendarDay?.actualDataAvailable ?? false;

  return (
    <Card className={brandCardClass}>
      <div className="ys-material-accent-strip" aria-hidden="true" />
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
          <div className="ys-sales-view-tabs inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              className={tabClass(view === "calendar")}
              onClick={() => setView("calendar")}
              type="button"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </button>
            <button
              className={tabClass(view === "performance")}
              onClick={() => setView("performance")}
              type="button"
            >
              <LineChart className="h-3.5 w-3.5" />
              Performance
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
              <SummaryTile
                helper={
                  calendar
                    ? `${calendar.summary.actualDataDays} day${calendar.summary.actualDataDays === 1 ? "" : "s"} with POS daily coverage`
                    : "Loading operational history"
                }
                label="Actual sales"
                value={formatCurrency(calendar?.summary.actualAmount ?? "0")}
              />
              <SummaryTile
                label="Forecast target"
                value={
                  calendar?.summary.targetAmount
                    ? formatCurrency(calendar.summary.targetAmount)
                    : "Unavailable"
                }
                helper={
                  calendar?.summary.targetDays
                    ? `${calendar.summary.targetDays} forecast-derived day${calendar.summary.targetDays === 1 ? "" : "s"}`
                    : "No active forecast target for this month"
                }
              />
              <SummaryTile
                label="Forecast"
                value={
                  !isOwner
                    ? "Protected"
                    : calendar?.summary.forecastAmount
                      ? formatCurrency(calendar.summary.forecastAmount)
                      : "Unavailable"
                }
                helper={
                  !isOwner
                    ? "Owner verification required"
                    : calendar?.summary.forecastUnits !== null &&
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

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.55fr)]">
              <div className="ys-sales-calendar overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3 sm:px-4">
                  <div className="flex items-center gap-2">
                    <Button
                      aria-label="Previous month"
                      className="h-8 w-8 p-0"
                      disabled={month <= SALES_CALENDAR_MIN_MONTH}
                      onClick={() => setMonth(clampCalendarMonth(offsetMonth(month, -1)))}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <label className="ys-sales-month-picker relative flex min-w-[164px] items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
                      <span className="sr-only">Choose month and year</span>
                      <input
                        aria-label="Choose month and year"
                        className="w-full cursor-pointer bg-transparent text-center text-sm font-semibold text-slate-900 outline-none"
                        min={SALES_CALENDAR_MIN_MONTH}
                        onChange={(event) => {
                          if (event.target.value) {
                            setMonth(clampCalendarMonth(event.target.value));
                          }
                        }}
                        type="month"
                        value={month}
                      />
                    </label>
                    <Button
                      aria-label="Next month"
                      className="h-8 w-8 p-0"
                      onClick={() => setMonth(clampCalendarMonth(offsetMonth(month, 1)))}
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

                <div className="ys-sales-weekdays grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
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
                      className="ys-sales-empty-day min-h-[78px] border-b border-r border-slate-100 bg-slate-50/30 sm:min-h-[96px]"
                      key={`empty-${index}`}
                    />
                  ))}
                  {calendar?.days.map((day) => {
                    const selected = day.date === selectedDate;
                    return (
                      <button
                        aria-label={`Open sales for ${day.date}`}
                        className={[
                          "ys-sales-day group min-h-[78px] border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-[96px] sm:p-2.5",
                          selected
                            ? "bg-violet-50 ring-2 ring-inset ring-[#625bff]"
                            : "hover:bg-slate-50",
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
                              : "—"
                            : day.actualDataAvailable
                              ? compactCurrencyFormatter.format(Number(day.actualAmount))
                              : "—"}
                        </p>
                        <p className="mt-0.5 hidden text-[10px] text-slate-400 sm:block">
                          {calendarDaySecondaryLabel(day)}
                        </p>
                      </button>
                    );
                  })}
                  {Array.from({ length: trailingDays }).map((_, index) => (
                    <div
                      className="ys-sales-empty-day min-h-[78px] border-b border-r border-slate-100 bg-slate-50/30 sm:min-h-[96px]"
                      key={`trailing-empty-${index}`}
                    />
                  ))}
                </div>
              </div>

              <div className="ys-sales-selected-day self-start rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#625bff]">
                  Selected day
                </p>
                <h4 className="mt-1 text-base font-semibold text-slate-950">
                  {formatDay(selectedDate)}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  {detail?.status === "FUTURE"
                    ? "Future forecast target"
                    : detail?.status === "TODAY"
                      ? "Live Manila business day"
                      : "Historical completed sales"}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniMetric
                    label="Actual"
                    value={
                      selectedActualAvailable ? formatCurrency(selectedAmount) : "No daily data"
                    }
                  />
                  <MiniMetric
                    label="Forecast target"
                    value={
                      detail?.targetAmount ? formatCurrency(detail.targetAmount) : "Unavailable"
                    }
                  />
                  <MiniMetric
                    label="Transactions"
                    value={(detail?.completedSales ?? 0).toLocaleString()}
                  />
                  <MiniMetric
                    label="Units sold"
                    value={(detail?.unitsSold ?? 0).toLocaleString()}
                  />
                  <MiniMetric label="Target progress" value={targetProgressLabel(detail)} />
                </div>

                {loadingDetail ? (
                  <p className="mt-3 text-xs text-slate-400">Loading day details…</p>
                ) : null}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Actuals come from completed POS sales. Daily targets are generated automatically from
              the active monthly forecast and reconcile back to that forecast. Historical dates
              without POS coverage remain blank rather than being treated as zero sales.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#625bff]">
                  Target vs actual
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatMonthLabel(month)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Daily completed-sales revenue against the forecast-derived target.
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight text-slate-950">
                  {calendar?.summary.targetAmount
                    ? formatCurrency(calendar.summary.targetAmount)
                    : "Forecast unavailable"}
                </p>
                <p className="mt-1 text-xs text-slate-500">Monthly forecast target</p>
              </div>
            </div>

            <div className="ys-sales-chart h-64 rounded-xl border border-slate-200 bg-slate-50/40 p-3">
              <ResponsiveContainer height="100%" width="100%">
                <ComposedChart
                  data={monthlyPerformanceData}
                  margin={{ bottom: 0, left: 0, right: 8, top: 8 }}
                >
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 6" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    interval={Math.max(0, Math.floor(monthlyPerformanceData.length / 10))}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(Number(value)),
                      name === "actual" ? "Actual" : "Forecast target"
                    ]}
                    labelFormatter={(label) => `Day ${String(label)}`}
                  />
                  <Bar dataKey="actual" fill="#625bff" name="actual" radius={[4, 4, 0, 0]} />
                  <Line
                    connectNulls
                    dataKey="target"
                    dot={false}
                    name="target"
                    stroke="#f43f8c"
                    strokeWidth={2}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.55fr)]">
              <div className="ys-sales-detail-chart rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDay(selectedDate)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Completed-sale revenue across 2-hour Manila windows.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold tracking-tight text-slate-950">
                      {loadingDetail
                        ? "Loading…"
                        : selectedActualAvailable
                          ? formatCurrency(selectedAmount)
                          : detail?.status === "FUTURE"
                            ? "Not started"
                            : "No daily history"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {(detail?.completedSales ?? 0).toLocaleString()} completed sales
                    </p>
                  </div>
                </div>
                <div className="h-56 w-full">
                  {loadingDetail ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-400">
                      Loading selected-day activity…
                    </div>
                  ) : detail && !detail.actualDataAvailable ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center text-xs font-medium text-slate-500">
                      {detail.status === "FUTURE"
                        ? "Actual sales activity will appear after this business day begins."
                        : "Daily POS history is not available for this date. No zero-sales value is being assumed."}
                    </div>
                  ) : (
                    <ResponsiveContainer height="100%" width="100%">
                      <AreaChart data={chartData} margin={{ bottom: 0, left: 0, right: 4, top: 8 }}>
                        <defs>
                          <linearGradient
                            id="dashboardSalesAreaCalendar"
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                          >
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
                          formatter={(value) => [formatCurrency(Number(value)), "Sales"]}
                          labelFormatter={(label) => String(label)}
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
                  )}
                </div>
              </div>

              <PerformanceSignal detail={detail} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function calendarDaySecondaryLabel(day: DashboardSalesCalendarDay) {
  if (day.status === "FUTURE") {
    return day.targetAmount ? "Forecast target" : "Forecast unavailable";
  }
  if (!day.actualDataAvailable) return "No POS history";
  if (day.targetAmount && Number(day.targetAmount) > 0) {
    const progress = Math.round((Number(day.actualAmount) / Number(day.targetAmount)) * 100);
    return `${progress}% of target`;
  }
  return `${day.completedSales} sale${day.completedSales === 1 ? "" : "s"}`;
}

function targetProgressLabel(detail: DashboardSalesDayDetail | null) {
  if (!detail?.targetAmount || Number(detail.targetAmount) <= 0) return "Unavailable";
  if (detail.status === "FUTURE") return "Starts on business day";
  if (!detail.actualDataAvailable) return "No daily actual";
  return `${Math.round((Number(detail.actualAmount) / Number(detail.targetAmount)) * 100)}%`;
}

function PerformanceSignal({ detail }: { detail: DashboardSalesDayDetail | null }) {
  const target = Number(detail?.targetAmount ?? 0);
  const actual = Number(detail?.actualAmount ?? 0);
  const hasComparableActual = Boolean(
    detail?.actualDataAvailable && target > 0 && detail?.status !== "FUTURE"
  );
  const achievement = hasComparableActual ? Math.round((actual / target) * 100) : null;
  const belowTarget = achievement !== null && achievement < 100;

  return (
    <div className="ys-sales-performance-signal rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#625bff]">
        Recommender signal
      </p>
      <p className="mt-2 text-base font-semibold text-slate-950">
        {achievement === null
          ? detail?.status === "FUTURE"
            ? "Waiting for actual sales"
            : "Not enough comparable daily data"
          : belowTarget
            ? "Below forecast target"
            : "Target met or exceeded"}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {achievement === null
          ? "The Inventory Recommender will evaluate this date when actual POS activity and a forecast target are both available."
          : belowTarget
            ? `Achievement is ${achievement}%. The Inventory Recommender evaluates inventory availability, incoming stock and demand signals before recommending an action.`
            : `Achievement is ${achievement}%. Stronger-than-expected demand is carried into inventory coverage and future replenishment decisions.`}
      </p>
      {detail?.targetAmount ? (
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <span className="text-slate-400">Actual</span>
            <strong className="mt-1 block text-slate-900">
              {detail.actualDataAvailable ? formatCurrency(detail.actualAmount) : "—"}
            </strong>
          </div>
          <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <span className="text-slate-400">Forecast target</span>
            <strong className="mt-1 block text-slate-900">
              {formatCurrency(detail.targetAmount)}
            </strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryTile({ helper, label, value }: { helper?: string; label: string; value: string }) {
  return (
    <div className="ys-sales-summary-tile rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-950">{value}</p>
      {helper ? <p className="mt-1 text-[11px] text-slate-500">{helper}</p> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ys-sales-mini-metric rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function tabClass(active: boolean) {
  return [
    "ys-sales-view-tab inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition",
    active
      ? "bg-white text-[#625bff] shadow-sm ring-1 ring-slate-200"
      : "text-slate-500 hover:text-slate-900"
  ].join(" ");
}

function formatCurrency(value: string | number) {
  return currencyFormatter.format(Number(value));
}

function formatMonthLabel(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));
}

function formatDay(date: string) {
  return dayFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function clampCalendarMonth(month: string) {
  return month < SALES_CALENDAR_MIN_MONTH ? SALES_CALENDAR_MIN_MONTH : month;
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
