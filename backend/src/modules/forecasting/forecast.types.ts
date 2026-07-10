export type ForecastModel = "SARIMA" | "SEASONAL_NAIVE" | "MOVING_AVERAGE";

export type ForecastStatus = "READY" | "WARNING" | "FAILED";

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
  productPrice: number;
  period: string;
  quantitySold: number;
};

export type ProductHistoricalSeries = {
  productId: string;
  productName: string;
  category: string;
  productPrice: number;
  historical: HistoricalSalesPoint[];
};

export type ForecastPoint = {
  period: string;
  predictedQuantity: number;
  recommendedQuantity: number;
  lowerConfidence: number | null;
  upperConfidence: number | null;
  sameMonthLastYear: number | null;
  differenceVersus2025: number | null;
  percentageChangeVersus2025: number | null;
};

export type ForecastMetrics = {
  mae: number | null;
  rmse: number | null;
  mape: number | null;
  wape: number | null;
  validationStrategy: string;
};

export type ForecastModelDetails = {
  model: ForecastModel;
  order: [number, number, number] | null;
  seasonalOrder: [number, number, number, number] | null;
  aic: number | null;
  converged: boolean | null;
};

export type ProductForecastDetail = {
  productId: string;
  productName: string;
  category: string;
  productPrice: number;
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
  status: ForecastStatus;
  model: ForecastModel | null;
  totalHistorical2024: number;
  totalHistorical2025: number;
  totalForecast2026: number;
  growthVersus2025: number | null;
  warningCount: number;
};

export type ForecastSort =
  | "productId"
  | "productName"
  | "category"
  | "model"
  | "status"
  | "totalForecast2026"
  | "growthVersus2025";

export type ForecastFilters = {
  search?: string;
  category?: string;
  model?: ForecastModel | "ALL";
  status?: ForecastStatus | "ALL";
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
  models: ForecastModel[];
  statuses: ForecastStatus[];
  generatedAt: string | null;
};

export type ForecastSummary = {
  generatedAt: string | null;
  actualUnits2024: number;
  actualUnits2025: number;
  forecastUnits2026: number;
  forecastGrowthVersus2025: number | null;
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
    actualUnits2024: number;
    actualUnits2025: number;
    forecastUnits2026: number;
  }[];
  monthlySummary: {
    period: string;
    actualUnits: number | null;
    forecastUnits: number | null;
  }[];
};

export type ForecastGenerationSummary = {
  generatedAt: string | null;
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

export type ForecastBatch = {
  products: ProductForecastDetail[];
  validation: HistoricalImportValidation;
  generation: ForecastGenerationSummary;
};
