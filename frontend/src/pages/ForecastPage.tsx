import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  generateForecasts,
  getForecastProduct,
  getForecastProducts
} from "@/services/forecastService";
import type {
  ForecastFilters,
  ForecastPoint,
  ForecastStatus,
  HistoricalSalesPoint,
  PaginatedForecastProductsResponse,
  ProductForecastDetail
} from "@/types/forecast";

const DEFAULT_FILTERS: ForecastFilters = {
  page: 1,
  pageSize: 12,
  sortBy: "productId",
  sortDirection: "asc",
  status: "ALL"
};

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${formatNumber(value, 1)}%`;
}

function formatStatusLabel(status: ForecastStatus) {
  switch (status) {
    case "READY":
      return "Ready";
    case "WARNING":
      return "Needs review";
    case "FAILED":
      return "Unavailable";
  }
}

function statusVariant(status: ForecastStatus) {
  switch (status) {
    case "READY":
      return "success";
    case "WARNING":
      return "warning";
    case "FAILED":
      return "error";
  }
}

function formatForecastNote(warning: string) {
  if (warning.includes("Only 24 monthly observations") || warning.includes("Only two seasonal")) {
    return "Forecast is based on the available two years of monthly sales history.";
  }

  if (warning.toLowerCase().includes("fallback")) {
    return "A backup forecasting method was used for this product.";
  }

  if (warning.includes("Confidence interval unavailable")) {
    return "Estimated range is unavailable for this product.";
  }

  return warning
    .replace(/SARIMA/gi, "forecast")
    .replace(/model/gi, "forecast")
    .replace(/convergence/gi, "calculation");
}

function buildChartData(historical: HistoricalSalesPoint[], forecast: ForecastPoint[]) {
  return [
    ...historical.map((point) => ({
      actual: point.quantitySold,
      forecast: null,
      lower: null,
      period: point.period,
      upper: null
    })),
    ...forecast.map((point) => ({
      actual: null,
      forecast: point.predictedQuantity,
      lower: point.lowerConfidence,
      period: point.period,
      upper: point.upperConfidence
    }))
  ];
}

export function ForecastPage() {
  const [filters, setFilters] = useState<ForecastFilters>(DEFAULT_FILTERS);
  const [data, setData] = useState<PaginatedForecastProductsResponse | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductForecastDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async (nextFilters: ForecastFilters) => {
    setLoadingList(true);
    setError(null);

    try {
      const response = await getForecastProducts(nextFilters);

      if (!response.success || !response.data) {
        setError(response.message);
        setData(null);
        return;
      }

      const productData = response.data;

      setData(productData);
      setSelectedProductId((current) => current ?? productData.items[0]?.productId ?? null);
    } catch {
      setError("Forecast API is unavailable. Please make sure the backend is running.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProducts(filters);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [filters, loadProducts]);

  useEffect(() => {
    if (!selectedProductId) {
      setSelectedProduct(null);
      return;
    }

    const productId = selectedProductId;
    let active = true;

    async function loadDetail() {
      setLoadingDetail(true);

      try {
        const response = await getForecastProduct(productId);

        if (active && response.success && response.data) {
          setSelectedProduct(response.data);
        }
      } finally {
        if (active) {
          setLoadingDetail(false);
        }
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [selectedProductId]);

  const chartData = useMemo(
    () =>
      selectedProduct ? buildChartData(selectedProduct.historical, selectedProduct.forecast) : [],
    [selectedProduct]
  );

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const response = await generateForecasts(true);

      if (!response.success) {
        setError(response.message);
        return;
      }

      await loadProducts(filters);
    } catch {
      setError("Forecast generation could not be completed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function updateFilter<K extends keyof ForecastFilters>(key: K, value: ForecastFilters[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? Number(value) : 1
    }));
  }

  return (
    <>
      <PageHeader
        eyebrow="Owner forecast"
        title="Demand Forecast"
        description="View this year's product demand forecast from verified sales history."
        actions={
          <Button disabled={generating} onClick={() => void handleGenerate()} type="button">
            <RefreshCw className={generating ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Generate
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <ForecastFiltersPanel
            categories={data?.categories ?? []}
            filters={filters}
            onChange={updateFilter}
          />
          <ProductTable
            data={data}
            loading={loadingList}
            selectedProductId={selectedProductId}
            onSelect={setSelectedProductId}
            onPageChange={(page) => updateFilter("page", page)}
          />
        </div>

        <div className="space-y-4">
          <SelectedProductDetail
            chartData={chartData}
            loading={loadingDetail}
            product={selectedProduct}
          />
        </div>
      </section>
    </>
  );
}

function ForecastFiltersPanel({
  categories,
  filters,
  onChange
}: {
  categories: string[];
  filters: ForecastFilters;
  onChange: <K extends keyof ForecastFilters>(key: K, value: ForecastFilters[K]) => void;
}) {
  return (
    <Card>
      <CardContent className="grid gap-3 pt-5 md:grid-cols-[1.3fr_1fr_1fr]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => onChange("search", event.target.value)}
            placeholder="Search product, ID, or category"
            value={filters.search ?? ""}
          />
        </label>

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          onChange={(event) => onChange("category", event.target.value || undefined)}
          value={filters.category ?? ""}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          onChange={(event) => onChange("status", event.target.value as ForecastStatus | "ALL")}
          value={filters.status}
        >
          <option value="ALL">All forecasts</option>
          <option value="READY">Ready</option>
          <option value="WARNING">Needs review</option>
          <option value="FAILED">Unavailable</option>
        </select>
      </CardContent>
    </Card>
  );
}

function ProductTable({
  data,
  loading,
  onPageChange,
  onSelect,
  selectedProductId
}: {
  data: PaginatedForecastProductsResponse | null;
  loading: boolean;
  onPageChange: (page: number) => void;
  onSelect: (productId: string) => void;
  selectedProductId: string | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Forecasted products</CardTitle>
        <StatusBadge variant="info">{data ? `${data.totalItems} products` : "Loading"}</StatusBadge>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="loading-shimmer h-12 rounded-md bg-slate-100" key={index} />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">This year</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr
                      className={
                        selectedProductId === item.productId
                          ? "cursor-pointer bg-emerald-50"
                          : "cursor-pointer hover:bg-slate-50"
                      }
                      key={item.productId}
                      onClick={() => onSelect(item.productId)}
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-950">{item.productName}</p>
                        <p className="text-xs text-slate-500">
                          {item.productId} - {item.category}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge variant={statusVariant(item.status)}>
                          {formatStatusLabel(item.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        {formatNumber(item.totalForecast2026)}
                        <p className="text-xs text-slate-500">
                          {formatPercent(item.growthVersus2025)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {data.page} of {data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={data.page <= 1}
                  onClick={() => onPageChange(data.page - 1)}
                  type="button"
                  variant="secondary"
                >
                  Previous
                </Button>
                <Button
                  disabled={data.page >= data.totalPages}
                  onClick={() => onPageChange(data.page + 1)}
                  type="button"
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            No forecast products match the current filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SelectedProductDetail({
  chartData,
  loading,
  product
}: {
  chartData: ReturnType<typeof buildChartData>;
  loading: boolean;
  product: ProductForecastDetail | null;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="loading-shimmer h-8 rounded-md bg-slate-100" />
          <div className="loading-shimmer h-72 rounded-md bg-slate-100" />
          <div className="loading-shimmer h-52 rounded-md bg-slate-100" />
        </CardContent>
      </Card>
    );
  }

  if (!product) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-slate-500">
          Select a product to view sales history, this year's forecast, and suggested quantities.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{product.productName}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {product.productId} - {product.category}
              </p>
            </div>
            <StatusBadge variant={statusVariant(product.status)}>
              {formatStatusLabel(product.status)}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Metric
            label="2025 sales"
            value={formatNumber(
              product.historical
                .filter((point) => point.period.startsWith("2025-"))
                .reduce((sum, point) => sum + point.quantitySold, 0)
            )}
          />
          <Metric
            label="Forecast this year"
            value={formatNumber(
              product.forecast.reduce((sum, point) => sum + point.recommendedQuantity, 0)
            )}
          />
          <Metric label="Forecast variance" value={formatPercent(product.metrics.wape)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales history and forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" minTickGap={24} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  connectNulls={false}
                  dataKey="actual"
                  name="Actual sales"
                  stroke="#047857"
                  strokeWidth={2}
                />
                <Line
                  connectNulls={false}
                  dataKey="forecast"
                  name="Forecast"
                  stroke="#2563eb"
                  strokeWidth={2}
                />
                <Line
                  connectNulls={false}
                  dataKey="lower"
                  name="Low range"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                />
                <Line
                  connectNulls={false}
                  dataKey="upper"
                  name="High range"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2026 monthly forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Month</th>
                  <th className="px-3 py-2 text-right">Forecast</th>
                  <th className="px-3 py-2 text-right">Suggested qty</th>
                  <th className="px-3 py-2 text-right">Low range</th>
                  <th className="px-3 py-2 text-right">High range</th>
                  <th className="px-3 py-2 text-right">2025</th>
                  <th className="px-3 py-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {product.forecast.map((point) => (
                  <tr className="border-t border-slate-100" key={point.period}>
                    <td className="px-3 py-2 font-medium">{point.period}</td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(point.predictedQuantity, 2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(point.recommendedQuantity)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(point.lowerConfidence, 2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(point.upperConfidence, 2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(point.sameMonthLastYear)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatPercent(point.percentageChangeVersus2025)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {product.warnings.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Forecast notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {product.warnings.slice(0, 6).map((warning) => (
              <div
                className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
                key={warning}
              >
                {formatForecastNote(warning)}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
