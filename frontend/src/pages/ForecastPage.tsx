import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  generateForecasts,
  getForecastProduct,
  getForecastProductCollection
} from "@/services/forecastService";
import type {
  ForecastPoint,
  PaginatedForecastProductsResponse,
  ProductForecastDetail
} from "@/types/forecast";
import {
  deriveForecastProducts,
  FORECAST_PRODUCTS_DESKTOP_QUERY,
  forecastSortOptions,
  formatForecastVariance,
  formatMonthLabel,
  getForecastProductsPageSize,
  getLocalMonthKey,
  paginateForecastProducts,
  type ForecastSortOption
} from "@/utils/forecastPresentation";

const MONTH_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const EMPTY_FORECAST_ROWS: ForecastPoint[] = [];

function getInitialForecastProductsPageSize() {
  return getForecastProductsPageSize(window.matchMedia(FORECAST_PRODUCTS_DESKTOP_QUERY).matches);
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function expectedChangeClassName(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "text-slate-500";
  }

  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-red-700";
  }

  return "text-slate-700";
}

function buildChartData(forecast: ForecastPoint[]) {
  return forecast.map((point) => ({
    forecastedDemand: point.predictedQuantity,
    month: formatMonthLabel(point.period),
    salesLastYear: point.comparisonSalesQuantity
  }));
}

export function ForecastPage() {
  const [forecastData, setForecastData] = useState<PaginatedForecastProductsResponse | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductForecastDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState<ForecastSortOption>("alphabeticalAsc");
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize, setProductsPageSize] = useState(getInitialForecastProductsPageSize);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeMonthRef = useRef(getLocalMonthKey());
  const loadingRef = useRef(false);

  const loadForecasts = useCallback(
    async (options: { background?: boolean; forceRefresh?: boolean } = {}) => {
      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;

      if (options.background) {
        setRefreshing(true);
      } else {
        setInitialLoading(true);
      }

      setError(null);

      try {
        if (options.forceRefresh) {
          const generationResponse = await generateForecasts(true);

          if (!generationResponse.success) {
            setError(generationResponse.message);
            return;
          }
        }

        const response = await getForecastProductCollection();

        if (!response.success || !response.data) {
          setError(response.message);
          setForecastData(null);
          return;
        }

        setForecastData(response.data);
      } catch {
        setError("Forecast data could not be loaded. Please make sure the backend is running.");
      } finally {
        loadingRef.current = false;
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadForecasts();
  }, [loadForecasts]);

  const allProducts = forecastData?.items ?? [];
  const categories = forecastData?.categories ?? [];
  const visibleProducts = useMemo(
    () =>
      deriveForecastProducts(allProducts, {
        category: selectedCategory,
        searchQuery,
        sortBy
      }),
    [allProducts, searchQuery, selectedCategory, sortBy]
  );
  const productPagination = useMemo(
    () =>
      paginateForecastProducts(visibleProducts, {
        page: productsPage,
        pageSize: productsPageSize
      }),
    [productsPage, productsPageSize, visibleProducts]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(FORECAST_PRODUCTS_DESKTOP_QUERY);
    const updatePageSize = () => {
      setProductsPageSize(getForecastProductsPageSize(mediaQuery.matches));
    };

    updatePageSize();
    mediaQuery.addEventListener("change", updatePageSize);

    return () => mediaQuery.removeEventListener("change", updatePageSize);
  }, []);

  useEffect(() => {
    setProductsPage(1);
  }, [searchQuery, selectedCategory, sortBy]);

  useEffect(() => {
    setProductsPage(productPagination.page);
  }, [productPagination.page]);

  useEffect(() => {
    if (visibleProducts.length === 0) {
      setSelectedProductId(null);
      return;
    }

    setSelectedProductId((current) =>
      current && visibleProducts.some((product) => product.productId === current)
        ? current
        : (visibleProducts.at(0)?.productId ?? null)
    );
  }, [visibleProducts]);

  useEffect(() => {
    if (!selectedProductId) {
      setSelectedProduct(null);
      return;
    }

    let active = true;
    const productId = selectedProductId;

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
  }, [forecastData?.generatedAt, selectedProductId]);

  const refreshIfMonthChanged = useCallback(() => {
    const currentMonth = getLocalMonthKey();

    if (currentMonth === activeMonthRef.current) {
      return;
    }

    activeMonthRef.current = currentMonth;
    void loadForecasts({ background: true, forceRefresh: true });
  }, [loadForecasts]);

  useEffect(() => {
    const intervalId = window.setInterval(refreshIfMonthChanged, MONTH_CHECK_INTERVAL_MS);
    const handleFocus = () => refreshIfMonthChanged();

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshIfMonthChanged]);

  const forecastRows = selectedProduct?.forecast ?? EMPTY_FORECAST_ROWS;
  const chartData = useMemo(() => buildChartData(forecastRows), [forecastRows]);

  const currentForecast = forecastRows[0] ?? null;
  const twelveMonthForecast = forecastRows.reduce((sum, point) => sum + point.predictedQuantity, 0);

  return (
    <>
      <PageHeader
        eyebrow="Owner forecast"
        title="Demand Forecast"
        description="View this year's product demand forecast from verified sales history."
      />

      {error ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span>{error}</span>
          </div>
          <Button onClick={() => void loadForecasts()} type="button" variant="secondary">
            Retry
          </Button>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr] xl:items-stretch">
        <ForecastedProductsCard
          categories={categories}
          dataLoaded={Boolean(forecastData)}
          loading={initialLoading}
          matchingProductsCount={visibleProducts.length}
          pagination={productPagination}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          selectedProductId={selectedProductId}
          sortBy={sortBy}
          totalProducts={allProducts.length}
          onCategoryChange={setSelectedCategory}
          onProductSelect={setSelectedProductId}
          onProductsPageChange={setProductsPage}
          onSearchChange={setSearchQuery}
          onSortChange={setSortBy}
        />

        <MonthlyForecastCard
          chartData={chartData}
          currentForecast={currentForecast}
          forecastRows={forecastRows}
          loading={initialLoading || loadingDetail}
          product={selectedProduct}
          refreshing={refreshing}
          twelveMonthForecast={twelveMonthForecast ?? null}
        />
      </section>
    </>
  );
}

function ForecastedProductsCard({
  categories,
  dataLoaded,
  loading,
  matchingProductsCount,
  onCategoryChange,
  onProductSelect,
  onProductsPageChange,
  onSearchChange,
  onSortChange,
  pagination,
  searchQuery,
  selectedCategory,
  selectedProductId,
  sortBy,
  totalProducts
}: {
  categories: string[];
  dataLoaded: boolean;
  loading: boolean;
  matchingProductsCount: number;
  onCategoryChange: (category: string) => void;
  onProductSelect: (productId: string) => void;
  onProductsPageChange: (page: number) => void;
  onSearchChange: (searchQuery: string) => void;
  onSortChange: (sortBy: ForecastSortOption) => void;
  pagination: ReturnType<typeof paginateForecastProducts>;
  searchQuery: string;
  selectedCategory: string;
  selectedProductId: string | null;
  sortBy: ForecastSortOption;
  totalProducts: number;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Forecasted Products</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              {dataLoaded
                ? `${matchingProductsCount} matching products out of ${totalProducts}`
                : "Loading forecasted products"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="relative block" aria-label="Search forecasted products">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              aria-label="Search product by name or SKU"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search product by name or SKU..."
              value={searchQuery}
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950"
            onChange={(event) => onCategoryChange(event.target.value)}
            value={selectedCategory}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950"
            onChange={(event) => onSortChange(event.target.value as ForecastSortOption)}
            value={sortBy}
          >
            {forecastSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 9 }, (_, index) => (
              <div className="loading-shimmer h-14 rounded-md bg-slate-100" key={index} />
            ))}
          </div>
        ) : pagination.items.length > 0 ? (
          <div className="flex h-full min-h-[32rem] flex-col justify-between gap-3">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Current Month</th>
                    <th className="px-3 py-2 text-right">12 Months</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.items.map((product) => (
                    <tr
                      className={
                        selectedProductId === product.productId
                          ? "cursor-pointer bg-emerald-50"
                          : "cursor-pointer hover:bg-slate-50"
                      }
                      key={product.productId}
                      onClick={() => onProductSelect(product.productId)}
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-950">{product.productName}</p>
                        <p className="text-xs text-slate-500">
                          {product.productCode} - {product.category}
                        </p>
                        <p
                          className={`mt-1 text-xs font-medium ${expectedChangeClassName(product.forecastVariancePercentage)}`}
                        >
                          {formatForecastVariance(product.forecastVariancePercentage)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        {formatNumber(product.currentMonthForecastQuantity)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        {formatNumber(product.twelveMonthForecastTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                {pagination.startItem}-{pagination.endItem} of {pagination.totalItems} products
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={pagination.page <= 1}
                  onClick={() => onProductsPageChange(pagination.page - 1)}
                  type="button"
                  variant="secondary"
                >
                  Previous
                </Button>
                <Button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => onProductsPageChange(pagination.page + 1)}
                  type="button"
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[18rem] items-center justify-center rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            No products match{" "}
            {searchQuery.trim() ? `"${searchQuery.trim()}"` : "the selected filters"}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MonthlyForecastCard({
  chartData,
  currentForecast,
  forecastRows,
  loading,
  product,
  refreshing,
  twelveMonthForecast
}: {
  chartData: ReturnType<typeof buildChartData>;
  currentForecast: ForecastPoint | null;
  forecastRows: ForecastPoint[];
  loading: boolean;
  product: ProductForecastDetail | null;
  refreshing: boolean;
  twelveMonthForecast: number | null;
}) {
  if (loading) {
    return (
      <Card className="flex h-full min-h-[34rem] flex-col">
        <CardContent className="space-y-4 pt-5">
          <div className="loading-shimmer h-8 rounded-md bg-slate-100" />
          <div className="loading-shimmer h-24 rounded-md bg-slate-100" />
          <div className="loading-shimmer h-72 rounded-md bg-slate-100" />
          <div className="loading-shimmer h-40 rounded-md bg-slate-100" />
        </CardContent>
      </Card>
    );
  }

  if (!product || !currentForecast) {
    return (
      <Card className="flex h-full min-h-[34rem] flex-col">
        <CardContent className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
          Select a product to view its 12-month forecast.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{product.productName}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              {product.productCode} - {product.category}
            </p>
          </div>
          {refreshing ? (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Refreshing
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-0">
        <div className="grid gap-3 md:grid-cols-3">
          <Metric
            label="Current Month Forecast"
            value={formatNumber(currentForecast.predictedQuantity, 1)}
          />
          <Metric label="12-Month Forecast" value={formatNumber(twelveMonthForecast, 1)} />
          <Metric
            label="Expected Change"
            supportingText="Compared with the same month last year"
            value={formatForecastVariance(currentForecast.forecastVariancePercentage)}
            valueClassName={expectedChangeClassName(currentForecast.forecastVariancePercentage)}
          />
        </div>

        <div className="min-h-[20rem] flex-1">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" minTickGap={16} />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value) => formatNumber(Number(value), 1)} />
              <Legend />
              <Line
                connectNulls={false}
                dataKey="forecastedDemand"
                name="Forecasted Demand"
                stroke="#2563eb"
                strokeWidth={2}
              />
              <Line
                connectNulls={false}
                dataKey="salesLastYear"
                name="Sales Last Year"
                stroke="#047857"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Month</th>
                <th className="px-3 py-2 text-right">Forecasted Demand</th>
                <th className="px-3 py-2 text-right">Sales Last Year</th>
                <th className="px-3 py-2 text-right">Expected Change</th>
              </tr>
            </thead>
            <tbody>
              {forecastRows.map((point) => (
                <tr className="border-t border-slate-100" key={point.period}>
                  <td className="px-3 py-2 font-medium">{formatMonthLabel(point.period)}</td>
                  <td className="px-3 py-2 text-right">
                    {formatNumber(point.predictedQuantity, 1)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatNumber(point.comparisonSalesQuantity)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${expectedChangeClassName(point.forecastVariancePercentage)}`}
                  >
                    {formatForecastVariance(point.forecastVariancePercentage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  supportingText,
  value,
  valueClassName
}: {
  label: string;
  supportingText?: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${valueClassName ?? "text-slate-950"}`}>{value}</p>
      {supportingText ? <p className="mt-1 text-xs text-slate-500">{supportingText}</p> : null}
    </div>
  );
}
