import { frontendEnv } from "@/schemas/frontendEnv.schema";
import { apiClient } from "@/services/apiClient";
import { getStoredAuthToken } from "@/services/authStorage";
import type { ApiResponse } from "@/types/api";

export type ProductCategorySummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
};

export type ProductCategoryRecord = ProductCategorySummary;

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
  unit: string;
  costPrice: string;
  sellingPrice: string;
  reorderLevel: number;
  targetStockLevel: number;
  status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
  isActive: boolean;
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
  costPrice: string;
  sellingPrice: string;
  reorderLevel: number;
  targetStockLevel: number;
  status?: ProductRecord["status"];
};

export type InventoryRecord = {
  inventoryId: string;
  currentQuantity: number;
  availableQuantity: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  lastStockUpdatedAt: string | null;
  version: number;
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
  return new URL(path, frontendEnv.VITE_API_BASE_URL).toString();
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
  query: {
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ items: InventoryRecord[]; meta: PaginationMeta }> {
  const queryString = buildQueryString(query);
  const response = await apiClient.request<InventoryRecord[], never, PaginationMeta>(
    `/api/inventory${queryString ? `?${queryString}` : ""}`
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
  query: { page?: number; pageSize?: number } = {}
) {
  const queryString = buildQueryString(query);
  const response = await apiClient.request<MovementRecord[], never, PaginationMeta>(
    `/api/inventory/${encodeURIComponent(productId)}/movements${queryString ? `?${queryString}` : ""}`
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
