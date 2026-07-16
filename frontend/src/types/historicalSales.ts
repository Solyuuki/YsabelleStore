export type HistoricalSalesImportMode =
  | "APPEND_ONLY"
  | "REJECT_ON_OVERLAP"
  | "REPLACE_IMPORTED_OVERLAPS";

export type HistoricalSalesBatchStatus =
  | "PREVIEWED"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_SKIPS"
  | "FAILED"
  | "ROLLED_BACK";

export type HistoricalSalesRowStatus =
  | "VALID"
  | "WARNING"
  | "INVALID"
  | "UNMATCHED"
  | "DUPLICATE"
  | "OVERLAP"
  | "IMPORTED"
  | "SKIPPED"
  | "REPLACED";

export type HistoricalSalesPreviewRow = {
  rowNumber: number;
  sku: string | null;
  barcode: string | null;
  productName: string | null;
  matchedProduct: { id: string; sku: string; barcode: string | null; name: string } | null;
  period: string | null;
  quantitySold: number | null;
  unitPrice: string | null;
  salesAmount: string | null;
  status: HistoricalSalesRowStatus;
  errors: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  importedOverlap: boolean;
  posActualOverlap: boolean;
};

export type HistoricalSalesPreview = {
  previewBatchId: string;
  batchCode: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  matchedRows: number;
  unmatchedRows: number;
  duplicateRows: number;
  overlapRows: number;
  posOverlapRows: number;
  productsAffected: number;
  sarimaEligibleProducts: number;
  productsBelowThreshold: number;
  rows: HistoricalSalesPreviewRow[];
};

export type HistoricalSalesBatch = {
  id: string;
  batchCode: string;
  originalFileName: string;
  fileHash: string;
  fileType: string;
  fileSize: number;
  importMode: HistoricalSalesImportMode;
  status: HistoricalSalesBatchStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  matchedRows: number;
  unmatchedRows: number;
  duplicateRows: number;
  overlapRows: number;
  posOverlapRows: number;
  importedRows: number;
  skippedRows: number;
  replacedRows: number;
  productsAffected: number;
  forecastRefreshStatus: "NOT_REQUIRED" | "PENDING" | "SUCCEEDED" | "FAILED";
  createdAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  rolledBackAt: string | null;
  rollbackReason: string | null;
  errorMessage: string | null;
  importedBy: { id: string; name: string };
  rolledBackBy?: { id: string; name: string } | null;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type HistoricalSalesAuditRow = {
  id: string;
  rowNumber: number;
  rawData: Record<string, string>;
  normalizedSku: string | null;
  normalizedBarcode: string | null;
  normalizedPeriod: string | null;
  quantitySold: number | null;
  unitPrice: string | null;
  salesAmount: string | null;
  status: HistoricalSalesRowStatus;
  errorCode: string | null;
  errorMessage: string | null;
  matchedProduct: { id: string; name: string; sku: string } | null;
};

export type HistoricalSalesEligibility = {
  productId: string;
  productName: string;
  observationCount: number;
  missingMonths: string[];
  zeroMonths: number;
  constantSeries: boolean;
  status: "ELIGIBLE" | "LIMITED_HISTORY" | "INSUFFICIENT_HISTORY" | "DATA_QUALITY_ISSUE";
  reason: string;
};

export type EligibilityResponse = Paginated<HistoricalSalesEligibility> & {
  counts: Record<HistoricalSalesEligibility["status"], number>;
};

export type RollbackImpact = {
  batchId: string;
  batchCode: string;
  recordsToInvalidate: number;
  recordsToRestore: number;
  productsAffected: number;
  periodsAffected: number;
  posCoveredPeriods: number;
  forecastsAffected: number;
};
