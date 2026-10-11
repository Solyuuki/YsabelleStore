export type ForecastModel = "SARIMA" | "SEASONAL_NAIVE" | "MOVING_AVERAGE";
export type ForecastStatus = "READY" | "WARNING" | "FAILED";
export type ForecastDeliveryStatus =
  | "READY"
  | "STALE"
  | "REFRESHING"
  | "GENERATING"
  | "FAILED_WITH_PREVIOUS"
  | "FAILED"
  | "EMPTY";

export type HistoricalImportIssue = {
  code: string;
  severity: "warning" | "error";
  workbookYear: number | null;
  row: number | null;
  productId: string | null;
  message: string;
};

export type HistoricalImportValidation = {
  valid: boolean;
  importedProducts: number;
  importedObservations: number;
  skippedProducts: number;
  warnings: HistoricalImportIssue[];
  errors: HistoricalImportIssue[];
};

export type HistoricalSalesPoint = {
  productId: string;
  productName: string;
  category: string;
  sellingPrice: number;
  period: string;
  quantitySold: number;
};

export type ForecastPoint = {
  period: string;
  predictedQuantity: number;
  recommendedQuantity: number;
  lowerConfidence: number | null;
  upperConfidence: number | null;
  sameMonthLastYear: number | null;
  /** @deprecated Use comparisonSalesQuantity and forecastVariancePercentage. */
  differenceVersus2025?: number | null;
  /** @deprecated Use forecastVariancePercentage. */
  percentageChangeVersus2025?: number | null;
  comparisonSalesQuantity: number | null;
  comparisonSalesEstimated?: boolean;
  forecastVariancePercentage: number | null;
};

export type ForecastMetrics = {
  mae: number | null;
  rmse: number | null;
  mape: number | null;
  wape: number | null;
  validationStrategy: string;
};

export type ForecastModelDetails = {
  model: ForecastModel | null;
  order: [number, number, number] | null;
  seasonalOrder: [number, number, number, number] | null;
  aic: number | null;
  converged: boolean | null;
};

export type ProductForecastDetail = {
  productId: string;
  productName: string;
  category: string;
  sellingPrice: number;
  status: ForecastStatus;
  model: ForecastModel | null;
  generatedAt: string;
  historical: HistoricalSalesPoint[];
  forecast: ForecastPoint[];
  metrics: ForecastMetrics;
  modelDetails: ForecastModelDetails;
  warnings: string[];
  error: string | null;
};

export type ForecastProductSummary = {
  productId: string;
  productName: string;
  category: string;
  currentMonthForecastQuantity: number | null;
  recentHistoricalSalesTotal: number;
  forecastHorizonMonths: number;
  forecastHorizonTotal: number;
  comparisonPeriodTotal: number | null;
  growthVersusComparisonPeriod: number | null;
  forecastVariancePercentage: number | null;
  warningCount: number;
  /** @deprecated Compatibility alias. Use forecastHorizonTotal. */
  totalForecast2026?: number;
  /** @deprecated Compatibility alias. Use growthVersusComparisonPeriod. */
  growthVersus2025?: number | null;
  /** @deprecated Compatibility alias. Use forecastHorizonTotal. */
  twelveMonthForecastTotal?: number;
  /** @deprecated Legacy year snapshot retained for older clients. */
  totalHistorical2024?: number;
  /** @deprecated Legacy year snapshot retained for older clients. */
  totalHistorical2025?: number;
};

export type ForecastSort =
  | "productId"
  | "productName"
  | "category"
  | "currentMonthForecastQuantity"
  | "recentHistoricalSalesTotal"
  | "forecastHorizonTotal"
  | "growthVersusComparisonPeriod"
  | "totalForecast2026"
  | "growthVersus2025"
  | "twelveMonthForecastTotal";

export type ForecastFilters = {
  search?: string;
  category?: string;
  sortBy: ForecastSort;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type PaginatedForecastProductsResponse = {
  items: ForecastProductSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  categories: string[];
  generatedAt: string | null;
  forecastStartMonth: string | null;
  forecastEndMonth: string | null;
  forecastHorizonMonths: number;
  status: ForecastDeliveryStatus;
  isStale: boolean;
  isRefreshing: boolean;
  batchId: string | null;
};

export type ForecastRefreshResponse = {
  accepted: boolean;
  status: ForecastDeliveryStatus;
  generationId: string | null;
  previousDataAvailable: boolean;
};

export type ForecastSummary = {
  generatedAt: string | null;
  historicalYears: {
    year: number;
    units: number;
  }[];
  forecastPeriod: {
    startMonth: string | null;
    endMonth: string | null;
    months: number;
    forecastUnits: number;
    comparisonUnits: number | null;
    growthVersusComparisonPeriod: number | null;
  };
  totalProductsForecasted: number;
  sarimaProducts: number;
  seasonalNaiveProducts: number;
  movingAverageProducts: number;
  warningProducts: number;
  failedProducts: number;
  topForecastedProducts: ForecastProductSummary[];
  highestGrowthProducts: ForecastProductSummary[];
  categorySummaries: {
    category: string;
    forecastHorizonTotal: number;
    comparisonPeriodTotal: number | null;
    growthVersusComparisonPeriod: number | null;
  }[];
  monthlySummary: {
    period: string;
    actualUnits: number | null;
    forecastUnits: number | null;
  }[];
  /** @deprecated Legacy compatibility field. */
  actualUnits2024?: number;
  /** @deprecated Legacy compatibility field. */
  actualUnits2025?: number;
  /** @deprecated Legacy compatibility field. */
  forecastUnits2026?: number;
  /** @deprecated Legacy compatibility field. */
  forecastGrowthVersus2025?: number | null;
};

export type ForecastGenerationSummary = {
  generatedAt: string | null;
  forecastStartMonth: string | null;
  forecastHorizonMonths: number;
  durationMs: number;
  totalProductsProcessed: number;
  sarimaProducts: number;
  seasonalNaiveProducts: number;
  movingAverageProducts: number;
  failedProducts: number;
  warningProducts: number;
  forecastPointsGenerated: number;
  firstForecastMonth: string | null;
  lastForecastMonth: string | null;
  nanCount: number;
  infinityCount: number;
  negativeOperationalQuantityCount: number;
  validation: HistoricalImportValidation;
};
