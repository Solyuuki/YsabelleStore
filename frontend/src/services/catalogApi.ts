import { resolveApiUrl } from "@/config/runtime";
import { apiClient } from "@/services/apiClient";
import { getStoredAuthToken } from "@/services/authStorage";
import type { ApiResponse } from "@/types/api";

export type CatalogRecordSource = "CATALOG" | "IMPORT" | "TEST_FIXTURE" | "INTERNAL";
export type CatalogQualityStatus = "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
export type ProductSizeUnit = "MILLILITER" | "LITER" | "GRAM" | "KILOGRAM" | "PIECE";

export type ProductCategorySummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  recordSource: CatalogRecordSource;
  dataQualityStatus: CatalogQualityStatus;
  isStorefrontVisible: boolean;
};

export type ProductCategoryRecord = ProductCategorySummary;

export type CreateCategoryInput = {
  description?: string | null;
  name: string;
  slug?: string | null;
};

export type ProductInventorySummary = {
  inventoryId: string;
  currentQuantity: number;
  availableQuantity: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  lastStockUpdatedAt: string | null;
  version: number;
};

export type ProductRecord = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  variant: string | null;
  sizeValue: string | null;
  sizeUnit: ProductSizeUnit | null;
  unit: string;
  costPrice: string;
  sellingPrice: string;
  reorderLevel: number;
  targetStockLevel: number;
  status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
  isActive: boolean;
  recordSource: CatalogRecordSource;
  dataQualityStatus: CatalogQualityStatus;
  isStorefrontVisible: boolean;
  qualityWarnings: string[];
  category: ProductCategorySummary;
  inventory: ProductInventorySummary;
  createdAt: string;
  updatedAt: string;
};

export type CreateProductInput = {
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId: string;
  unit: ProductRecord["unit"];
  description?: string | null;
  imageUrl?: string | null;
  costPrice: string;
  sellingPrice: string;
  reorderLevel: number;
  targetStockLevel: number;
  status?: ProductRecord["status"];
  brand?: string | null;
  variant?: string | null;
  sizeValue?: number | null;
  sizeUnit?: ProductSizeUnit | null;
  dataQualityStatus?: CatalogQualityStatus;
  isStorefrontVisible?: boolean;
};

export type InventoryRecord = {
  inventoryId: string;
  currentQuantity: number;
  availableQuantity: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  lastStockUpdatedAt: string | null;
  version: number;
  batchCount: number;
  nearestExpiry: string | null;
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  unit: string;
  costPrice: string;
  sellingPrice: string;
  reorderLevel: number;
  targetStockLevel: number;
  status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
  isActive: boolean;
  category: ProductCategorySummary;
  createdAt: string;
  updatedAt: string;
  availability: boolean;
};

export type InventoryStockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type InventorySortBy =
  | "productName"
  | "sku"
  | "barcode"
  | "quantityOnHand"
  | "reorderLevel"
  | "lastStockUpdatedAt"
  | "createdAt"
  | "updatedAt";
export type InventoryMovementType =
  | "STOCK_IN"
  | "SALE"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "RETURN_IN"
  | "RETURN_OUT"
  | "DAMAGE"
  | "EXPIRED"
  | "INITIAL_STOCK";

export type InventoryListQuery = {
  search?: string;
  categoryId?: string;
  category?: string;
  productStatus?: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
  stockStatus?: "ALL" | InventoryStockStatus;
  page?: number;
  pageSize?: number;
  sortBy?: InventorySortBy;
  sortOrder?: "asc" | "desc";
};

export type InventoryMovementQuery = {
  movementType?: InventoryMovementType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type StockInRequest = {
  quantity: number;
  batchCode: string;
  expiresAt?: string | null;
};

export type StockAdjustmentRequest = {
  movementType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  quantity: number;
  reason: string;
};

export type InventoryImportError = {
  rowNumber?: number;
  field?: string;
  code: string;
  message: string;
  value?: string | null;
  productId?: string | null;
  productName?: string | null;
};

export type InventoryImportRowResult = {
  rowNumber: number;
  productId: string | null;
  productName: string | null;
  valid: boolean;
  errors: InventoryImportError[];
  warnings: InventoryImportError[];
};

export type InventoryImportPreview = {
  fileName: string;
  fileType: "csv" | "xlsx";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: InventoryImportRowResult[];
  errors: InventoryImportError[];
  warnings: InventoryImportError[];
};

export type InventoryImportSummary = {
  importId: string;
  fileName: string;
  fileType: "csv" | "xlsx";
  totalRows: number;
  importedRows: number;
  failedRows: number;
  productsUpdated: number;
  batchesCreated: number;
  batchesUpdated: number;
  totalUnitsAdded: number;
  expiryRecordsAdded: number;
  referenceId: string;
  completedAt: string;
  errors: InventoryImportError[];
  warnings: InventoryImportError[];
};

export type BarcodeLookupResult = {
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  sellingPrice: string;
  currentStock: number;
  available: boolean;
  isActive: boolean;
  stockStatus: InventoryStockStatus;
  category: ProductCategorySummary;
};

export type InventoryMutationResult = {
  inventory: InventoryRecord;
  movement: MovementRecord;
};

export type MovementRecord = {
  id: string;
  productId: string;
  inventoryId: string;
  type: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  performedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
};

export type ProductImportIssue = {
  rowNumber?: number;
  field?: string;
  code: string;
  message: string;
  value?: string | null;
  existingProductId?: string;
};

export type ProductImportRow = {
  rowNumber: number;
  normalizedData: {
    name: string;
    sku: string;
    barcode: string | null;
    category: string;
    categoryId: string;
    unit: string;
    costPrice: string;
    sellingPrice: string;
    reorderLevel: number;
    targetStockLevel: number;
    initialStock: number;
    status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
    description: string | null;
    imageUrl: string | null;
  } | null;
  valid: boolean;
  errors: ProductImportIssue[];
  warnings: ProductImportIssue[];
};

export type ProductImportPreview = {
  fileName: string;
  fileType: "csv" | "xlsx";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  ignoredColumns: string[];
  detectedColumns: string[];
  rows: ProductImportRow[];
  errors: ProductImportIssue[];
  warnings: ProductImportIssue[];
};

export type ProductImportSummary = {
  importId: string;
  fileName: string;
  fileType: "csv" | "xlsx";
  totalRows: number;
  importedRows: number;
  failedRows: number;
  skippedRows: number;
  productsCreated: number;
  inventoryRowsCreated: number;
  initialMovementsCreated: number;
  errors: ProductImportIssue[];
  warnings: ProductImportIssue[];
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ProductImportResponse = ApiResponse<ProductImportPreview, ProductImportIssue[], never>;

function buildQueryString(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

function buildApiUrl(path: string) {
  return resolveApiUrl(path).toString();
}

async function downloadText(url: string) {
  const response = await fetch(url, {
    headers: getStoredAuthToken()
      ? {
          Authorization: `Bearer ${getStoredAuthToken()}`
        }
      : undefined
  });

  if (!response.ok) {
    throw new Error(`Template download failed with status ${response.status}.`);
  }

  return response.text();
}

export async function fetchProducts(
  query: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {},
  options: Pick<RequestInit, "signal"> = {}
): Promise<{ items: ProductRecord[]; meta: PaginationMeta }> {
  const queryString = buildQueryString(query);
  const response = await apiClient.request<ProductRecord[], never, PaginationMeta>(
    `/api/catalog/products${queryString ? `?${queryString}` : ""}`,
    options
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return {
    items: response.data,
    meta: response.meta ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      totalItems: response.data.length,
      totalPages: 1
    }
  };
}

export async function fetchInventory(
  query: InventoryListQuery = {},
  options: Pick<RequestInit, "signal"> = {}
): Promise<{ items: InventoryRecord[]; meta: PaginationMeta }> {
  const queryString = buildQueryString(query);
  const response = await apiClient.request<InventoryRecord[], never, PaginationMeta>(
    `/api/inventory${queryString ? `?${queryString}` : ""}`,
    options
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return {
    items: response.data,
    meta: response.meta ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      totalItems: response.data.length,
      totalPages: 1
    }
  };
}

export async function fetchMovements(
  productId: string,
  query: InventoryMovementQuery = {},
  options: Pick<RequestInit, "signal"> = {}
) {
  const queryString = buildQueryString(query);
  const response = await apiClient.request<MovementRecord[], never, PaginationMeta>(
    `/api/inventory/${encodeURIComponent(productId)}/movements${queryString ? `?${queryString}` : ""}`,
    options
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return {
    items: response.data,
    meta: response.meta ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      totalItems: response.data.length,
      totalPages: 1
    }
  };
}

export async function fetchInventoryByProductId(
  productId: string,
  options: Pick<RequestInit, "signal"> = {}
) {
  const response = await apiClient.request<InventoryRecord, never>(
    `/api/inventory/product/${encodeURIComponent(productId)}`,
    options
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function lookupInventoryByBarcode(
  barcode: string,
  options: Pick<RequestInit, "signal"> = {}
) {
  const queryString = buildQueryString({ barcode });
  const response = await apiClient.request<BarcodeLookupResult, never>(
    `/api/inventory/lookup?${queryString}`,
    options
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function stockInInventory(productId: string, input: StockInRequest) {
  const response = await apiClient.request<InventoryMutationResult, { code?: string }>(
    `/api/inventory/${encodeURIComponent(productId)}/stock-in`,
    {
      method: "POST",
      json: input
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function adjustInventoryStock(productId: string, input: StockAdjustmentRequest) {
  const response = await apiClient.request<InventoryMutationResult, { code?: string }>(
    `/api/inventory/${encodeURIComponent(productId)}/adjust`,
    {
      method: "POST",
      json: input
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function createProduct(input: CreateProductInput) {
  return apiClient.request<ProductRecord, { code?: string; details?: unknown }>(
    "/api/catalog/products",
    {
      method: "POST",
      json: input
    }
  );
}

export async function fetchCategories() {
  const response = await apiClient.request<ProductCategoryRecord[], never>(
    "/api/catalog/products/categories"
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function createCategory(input: CreateCategoryInput) {
  const response = await apiClient.request<
    ProductCategoryRecord,
    { code?: string; details?: unknown }
  >("/api/catalog/categories", {
    method: "POST",
    json: input
  });

  return response;
}

export async function fetchProductById(productId: string) {
  const response = await apiClient.request<ProductRecord, { code?: string; details?: unknown }>(
    `/api/catalog/products/${encodeURIComponent(productId)}`
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function updateProductStatus(productId: string, status: ProductRecord["status"]) {
  const response = await apiClient.request<ProductRecord, { code?: string; details?: unknown }>(
    `/api/catalog/products/${encodeURIComponent(productId)}/status`,
    {
      method: "PATCH",
      json: {
        status
      }
    }
  );

  return response;
}

export async function updateProduct(
  productId: string,
  input: Partial<
    Pick<
      CreateProductInput,
      | "name"
      | "barcode"
      | "categoryId"
      | "unit"
      | "description"
      | "imageUrl"
      | "brand"
      | "variant"
      | "sizeValue"
      | "sizeUnit"
      | "dataQualityStatus"
      | "isStorefrontVisible"
      | "costPrice"
      | "sellingPrice"
      | "reorderLevel"
      | "targetStockLevel"
    >
  >
) {
  return apiClient.request<ProductRecord, { code?: string; details?: unknown }>(
    `/api/catalog/products/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      json: input
    }
  );
}

export async function previewProductImport(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return apiClient.request<ProductImportPreview, { code?: string; details?: unknown }>(
    "/api/catalog/products/import/preview",
    {
      method: "POST",
      formData
    }
  );
}

export async function importProducts(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return apiClient.request<ProductImportSummary, { code?: string; details?: unknown }>(
    "/api/catalog/products/import",
    {
      method: "POST",
      formData
    }
  );
}

export async function downloadProductImportTemplate() {
  return downloadText(buildApiUrl("/api/catalog/products/import/template"));
}

export async function downloadInventoryStockImportTemplate() {
  return downloadText(buildApiUrl("/api/inventory/import/template"));
}

export async function previewInventoryStockImport(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return apiClient.request<InventoryImportPreview, { code?: string; details?: unknown }>(
    "/api/inventory/import/preview",
    {
      method: "POST",
      formData
    }
  );
}

export async function confirmInventoryStockImport(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return apiClient.request<InventoryImportSummary, { code?: string; details?: unknown }>(
    "/api/inventory/import/confirm",
    {
      method: "POST",
      formData
    }
  );
}
