import { AlertTriangle, LoaderCircle, Search } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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

import { EmptyState } from "@/components/shared/EmptyState";
import { AppPagination } from "@/components/shared/AppPagination";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  ForecastProductSummary,
  ProductForecastDetail
} from "@/types/forecast";
import {
  FORECAST_PRODUCTS_DESKTOP_QUERY,
  forecastSortOptions,
  formatForecastVariance,
  formatMonthLabel,
  getForecastProductsPageSize,
  getForecastServerSort,
  getLocalMonthKey,
  type ForecastSortOption
} from "@/utils/forecastPresentation";

const MONTH_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const FORECAST_REFRESH_POLL_MS = 2_000;
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

function formatForecastTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
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
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const activeMonthRef = useRef(getLocalMonthKey());
  const forecastDataRef = useRef<PaginatedForecastProductsResponse | null>(null);
  const collectionRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  useEffect(() => {
    forecastDataRef.current = forecastData;
  }, [forecastData]);

  const loadSelectedProductDetail = useCallback(
    async (productId: string, options: { interactive?: boolean } = {}) => {
      const interactive = options.interactive ?? true;
      const requestId = ++detailRequestRef.current;

      if (interactive) {
        setLoadingDetail(true);
        setDetailError(null);
        setSelectedProduct(null);
      }

      try {
        const response = await getForecastProduct(productId, forecastDataRef.current?.batchId);

        if (requestId !== detailRequestRef.current) {
          return;
        }

        if (!response.success || !response.data) {
          if (interactive) {
            setDetailError(response.message || "Product forecast could not be loaded.");
          }

          return;
        }

        setSelectedProduct(response.data);
        setDetailError(null);
      } catch {
        if (requestId !== detailRequestRef.current) {
          return;
        }

        if (interactive) {
          setDetailError("Product forecast could not be loaded. Please try again.");
          setSelectedProduct(null);
        }
      } finally {
        if (interactive && requestId === detailRequestRef.current) {
          setLoadingDetail(false);
        }
      }
    },
    []
  );

  const loadForecasts = useCallback(
    async (options: { background?: boolean; forceRefresh?: boolean } = {}) => {
      const requestId = ++collectionRequestRef.current;
      const hadForecastData = forecastDataRef.current !== null;
      const isBackground = options.background ?? hadForecastData;

      if (isBackground && hadForecastData) {
        setRefreshing(true);
      } else {
        setInitialLoading(true);
      }

      setCollectionError(null);

      try {
        if (options.forceRefresh) {
          const generationResponse = await generateForecasts(true);

          if (!generationResponse.success) {
            throw new Error(generationResponse.message);
          }
        }

        const response = await getForecastProductCollection({
          category: selectedCategory || undefined,
          page: productsPage,
          pageSize: productsPageSize,
          search: deferredSearchQuery || undefined,
          ...getForecastServerSort(sortBy)
        });

        if (requestId !== collectionRequestRef.current) return;

        if (!response.success || !response.data) {
          throw new Error(response.message || "Forecast data could not be loaded.");
        }

        setForecastData(response.data);
      } catch {
        if (requestId !== collectionRequestRef.current) return;
        setCollectionError(
          hadForecastData
            ? "Forecast update failed. Showing the last available forecast."
            : "Forecast data could not be loaded. Please make sure the backend is running."
        );

        if (!hadForecastData) {
          setForecastData(null);
        }
      } finally {
        if (requestId === collectionRequestRef.current) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    },
    [deferredSearchQuery, productsPage, productsPageSize, selectedCategory, sortBy]
  );

  useEffect(() => {
    void loadForecasts();
  }, [loadForecasts]);

  const pageProducts = forecastData?.items ?? [];
  const categories = forecastData?.categories ?? [];

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
  }, [deferredSearchQuery, selectedCategory, sortBy]);

  useEffect(() => {
    if (forecastData && forecastData.page !== productsPage) {
      setProductsPage(forecastData.page);
    }
  }, [forecastData, productsPage]);

  useEffect(() => {
    if (pageProducts.length === 0) {
      setSelectedProductId(null);
      return;
    }

    setSelectedProductId((current) =>
      current && pageProducts.some((product) => product.productId === current)
        ? current
        : (pageProducts.at(0)?.productId ?? null)
    );
  }, [pageProducts]);

  useEffect(() => {
    if (!selectedProductId) {
      detailRequestRef.current += 1;
      setSelectedProduct(null);
      setDetailError(null);
      setLoadingDetail(false);
      return;
    }

    void loadSelectedProductDetail(selectedProductId);
  }, [forecastData?.batchId, loadSelectedProductDetail, selectedProductId]);

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

  useEffect(() => {
    if (!forecastData?.isRefreshing && forecastData?.status !== "GENERATING") return;
    const timeoutId = window.setTimeout(() => {
      void loadForecasts({ background: true });
    }, FORECAST_REFRESH_POLL_MS);
    return () => window.clearTimeout(timeoutId);
  }, [forecastData?.isRefreshing, forecastData?.status, loadForecasts]);

  const forecastRows = selectedProduct?.forecast ?? EMPTY_FORECAST_ROWS;
  const chartData = useMemo(() => buildChartData(forecastRows), [forecastRows]);

  const currentForecast = forecastRows[0] ?? null;
  const twelveMonthForecast = selectedProduct
    ? forecastRows.reduce((sum, point) => sum + point.predictedQuantity, 0)
    : null;
  const selectedProductSummary = useMemo(
    () => pageProducts.find((product) => product.productId === selectedProductId) ?? null,
    [pageProducts, selectedProductId]
  );
  const hasForecastData = Boolean(forecastData?.batchId && forecastData.status !== "EMPTY");
  const deliveryError =
    forecastData?.status === "FAILED_WITH_PREVIOUS"
      ? "The latest forecast refresh failed."
      : forecastData?.status === "FAILED"
        ? "Forecast generation failed. Please retry."
        : null;
  const effectiveCollectionError = collectionError ?? deliveryError;
  const blockingCollectionError = Boolean(effectiveCollectionError && !forecastData?.batchId);
  const refreshCollectionError = Boolean(effectiveCollectionError && forecastData?.batchId);
  const generationPending = forecastData?.status === "GENERATING";
  const listLoading = (initialLoading && !hasForecastData) || generationPending;
  const listControlsDisabled =
    listLoading || blockingCollectionError || forecastData?.status === "EMPTY";
  const refreshInProgress = refreshing || forecastData?.isRefreshing;

  return (
    <>
      <PageHeader
        eyebrow="Owner forecast"
        title="Demand Forecast"
        description="View this year's product demand forecast from verified sales history."
      />

      {effectiveCollectionError ? (
        <Alert
          className={
            refreshCollectionError ? "mb-4 border-amber-200 bg-amber-50 text-amber-900" : "mb-4"
          }
          role="alert"
          variant={refreshCollectionError ? "default" : "destructive"}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={
                refreshCollectionError
                  ? "mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                  : "mt-0.5 h-4 w-4 shrink-0"
              }
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <AlertTitle>
                {refreshCollectionError ? "Forecast update failed" : "Forecast unavailable"}
              </AlertTitle>
              <AlertDescription className="flex items-start justify-between gap-4">
                <span>
                  {effectiveCollectionError}
                  {refreshCollectionError ? " The last available forecast remains visible." : ""}
                </span>
                <Button
                  onClick={() =>
                    void loadForecasts({
                      background: hasForecastData,
                      forceRefresh: hasForecastData
                    })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Retry
                </Button>
              </AlertDescription>
            </div>
          </div>
        </Alert>
      ) : null}

      {refreshInProgress && hasForecastData && forecastData?.status !== "GENERATING" ? (
        <div
          className="mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
          aria-live="polite"
        >
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Updating forecasts...
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr] xl:items-stretch">
        <ForecastedProductsCard
          categories={categories}
          generatedAt={forecastData?.generatedAt ?? null}
          loading={listLoading}
          networkUpdating={refreshing}
          pagination={forecastData}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          selectedProductId={selectedProductId}
          sortBy={sortBy}
          totalProducts={forecastData?.totalItems ?? 0}
          deliveryStatus={forecastData?.status ?? null}
          hasForecastData={hasForecastData}
          collectionError={effectiveCollectionError}
          listControlsDisabled={listControlsDisabled}
          onCategoryChange={setSelectedCategory}
          onProductSelect={setSelectedProductId}
          onProductsPageChange={setProductsPage}
          onSearchChange={setSearchQuery}
          onSortChange={setSortBy}
        />

        <MonthlyForecastCard
          chartData={chartData}
          currentForecast={currentForecast}
          collectionError={effectiveCollectionError}
          detailError={detailError}
          initialLoading={listLoading}
          hasForecastData={hasForecastData}
          isEmptyForecast={forecastData?.status === "EMPTY"}
          loadingDetail={loadingDetail}
          onRetryDetail={() => {
            const productId = selectedProductSummary?.productId;

            if (productId) {
              void loadSelectedProductDetail(productId);
            }
          }}
          selectedSummary={selectedProductSummary}
          forecastRows={forecastRows}
          product={selectedProduct}
          twelveMonthForecast={twelveMonthForecast ?? null}
        />
      </section>
    </>
  );
}

function ForecastedProductsCard({
  categories,
  collectionError,
  deliveryStatus,
  generatedAt,
  loading,
  networkUpdating,
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
  totalProducts,
  hasForecastData,
  listControlsDisabled
}: {
  categories: string[];
  collectionError: string | null;
  deliveryStatus: PaginatedForecastProductsResponse["status"] | null;
  generatedAt: string | null;
  loading: boolean;
  networkUpdating: boolean;
  onCategoryChange: (category: string) => void;
  onProductSelect: (productId: string) => void;
  onProductsPageChange: (page: number) => void;
  onSearchChange: (searchQuery: string) => void;
  onSortChange: (sortBy: ForecastSortOption) => void;
  pagination: PaginatedForecastProductsResponse | null;
  searchQuery: string;
  selectedCategory: string;
  selectedProductId: string | null;
  sortBy: ForecastSortOption;
  totalProducts: number;
  hasForecastData: boolean;
  listControlsDisabled: boolean;
}) {
  const generatedLabel = formatForecastTimestamp(generatedAt);
  const subtitle = loading
    ? "Retrieving the latest verified demand forecast."
    : deliveryStatus === "EMPTY"
      ? "No forecast data available yet."
      : hasForecastData
        ? `${totalProducts} matching product${totalProducts === 1 ? "" : "s"}`
        : collectionError
          ? "Forecast data could not be loaded."
          : "Loading forecast data.";

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Forecasted Products</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            {generatedLabel ? (
              <p className="mt-1 text-xs text-slate-500">Generated {generatedLabel}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="relative block" aria-label="Search forecasted products">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              aria-label="Search product by name or product ID"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              disabled={listControlsDisabled}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search product by name or product ID..."
              value={searchQuery}
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            disabled={listControlsDisabled}
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
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            disabled={listControlsDisabled}
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
        <div className="flex min-h-full flex-col gap-4" aria-busy={loading}>
          {loading ? (
            <div className="max-w-md" aria-live="polite">
              <LoadingState
                badge="Forecast"
                helper="Retrieving the latest verified demand forecast."
                label="Loading forecasted products"
              />
            </div>
          ) : collectionError && !hasForecastData ? (
            <EmptyState
              description="The demand forecast could not be loaded. Use Retry above to try again."
              icon={AlertTriangle}
              title="Forecast unavailable"
            />
          ) : deliveryStatus === "EMPTY" ? (
            <EmptyState
              description="Import approved historical sales or record enough POS sales before generating demand forecasts."
              icon={AlertTriangle}
              title="No forecast data available"
            />
          ) : pagination && pagination.items.length > 0 ? (
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
                            {product.productId} - {product.category}
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

              <AppPagination
                isLoading={networkUpdating}
                itemLabel="products"
                onPageChange={onProductsPageChange}
                page={pagination.page}
                pageSize={pagination.pageSize}
                pageSizeOptions={[]}
                totalItems={pagination.totalItems}
                totalPages={pagination.totalPages}
              />
            </div>
          ) : (
            <EmptyState
              description="Try changing the search term, category, or sorting option."
              icon={Search}
              title="No forecasted products found"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyForecastCard({
  chartData,
  currentForecast,
  collectionError,
  detailError,
  initialLoading,
  hasForecastData,
  isEmptyForecast,
  loadingDetail,
  forecastRows,
  onRetryDetail,
  product,
  selectedSummary,
  twelveMonthForecast
}: {
  chartData: ReturnType<typeof buildChartData>;
  currentForecast: ForecastPoint | null;
  collectionError: string | null;
  detailError: string | null;
  initialLoading: boolean;
  hasForecastData: boolean;
  isEmptyForecast: boolean;
  loadingDetail: boolean;
  forecastRows: ForecastPoint[];
  onRetryDetail: () => void;
  product: ProductForecastDetail | null;
  selectedSummary: ForecastProductSummary | null;
  twelveMonthForecast: number | null;
}) {
  const detailTitle = product?.productName ?? selectedSummary?.productName ?? "Forecast details";
  const detailSubtitle = product
    ? `${product.productId} - ${product.category}`
    : selectedSummary
      ? `${selectedSummary.productId} - ${selectedSummary.category}`
      : hasForecastData
        ? "Select a product to view its 12-month forecast."
        : "The selected product forecast will appear when data is ready.";

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{detailTitle}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{detailSubtitle}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent
        className="flex min-h-0 flex-1 flex-col gap-4 pt-0"
        aria-busy={initialLoading || loadingDetail}
      >
        {initialLoading ? (
          <div className="max-w-md" aria-live="polite">
            <LoadingState
              badge="Forecast details"
              helper="The selected product forecast will appear when data is ready."
              label="Preparing forecast details"
            />
          </div>
        ) : loadingDetail ? (
          <div className="max-w-md" aria-live="polite">
            <LoadingState
              badge="Forecast details"
              helper="The selected product forecast will appear when data is ready."
              label="Preparing forecast details"
            />
          </div>
        ) : collectionError && !hasForecastData ? (
          <EmptyState
            description="The demand forecast could not be loaded. Use Retry above to try again."
            icon={AlertTriangle}
            title="Forecast unavailable"
          />
        ) : isEmptyForecast ? (
          <EmptyState
            description="Import approved historical sales or record enough POS sales before generating demand forecasts."
            icon={AlertTriangle}
            title="No forecast data available"
          />
        ) : detailError ? (
          <Alert
            className="border-red-200 bg-red-50 text-red-800"
            role="alert"
            variant="destructive"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <AlertTitle>Product forecast unavailable</AlertTitle>
                <AlertDescription className="flex items-start justify-between gap-4">
                  <span>{detailError}</span>
                  <Button onClick={onRetryDetail} size="sm" type="button" variant="secondary">
                    Retry
                  </Button>
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ) : collectionError && hasForecastData && !product ? (
          <Alert
            className="border-amber-200 bg-amber-50 text-amber-900"
            role="alert"
            variant="default"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <AlertTitle>Product forecast unavailable</AlertTitle>
                <AlertDescription>{collectionError}</AlertDescription>
              </div>
            </div>
          </Alert>
        ) : !product || !currentForecast ? (
          <EmptyState
            description={
              hasForecastData
                ? "Select a product to view its 12-month forecast."
                : "The selected product forecast will appear when data is ready."
            }
            icon={AlertTriangle}
            title={hasForecastData ? "Select a product" : "Forecast details unavailable"}
          />
        ) : (
          <>
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
          </>
        )}
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
