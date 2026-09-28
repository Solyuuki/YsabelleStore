import { resolveApiUrl } from "@/config/runtime";
import { apiClient } from "@/services/apiClient";
import type { PaginationMeta } from "@/services/catalogApi";

export type CategoryCoverStatus =
  | "MISSING"
  | "PROCESSING"
  | "NEEDS_REVIEW"
  | "READY"
  | "FAILED";

export type CategoryCoverPosition =
  | "LEFT"
  | "CENTER"
  | "RIGHT"
  | "TOP"
  | "BOTTOM"
  | "TOP_LEFT"
  | "TOP_RIGHT"
  | "BOTTOM_LEFT"
  | "BOTTOM_RIGHT";
export type CategoryVisibilityFilter = "ALL" | "VISIBLE" | "HIDDEN";
export type CategoryStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
export type CategoryCoverStatusFilter = "ALL" | CategoryCoverStatus;
export type CategorySortBy = "updatedAt" | "name" | "productCount";
export type CategorySortOrder = "asc" | "desc";

export type ManagedCategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  recordSource: "CATALOG" | "IMPORT" | "TEST_FIXTURE" | "INTERNAL";
  dataQualityStatus: "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
  isStorefrontVisible: boolean;
  activeCoverAssetId: string | null;
  coverStatus: CategoryCoverStatus;
  coverPosition: CategoryCoverPosition;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryListQuery = {
  search?: string;
  coverStatus?: CategoryCoverStatusFilter;
  visibility?: CategoryVisibilityFilter;
  status?: CategoryStatusFilter;
  page?: number;
  pageSize?: number;
  sortBy?: CategorySortBy;
  sortOrder?: CategorySortOrder;
};

export type CreateManagedCategoryInput = {
  name: string;
  slug?: string;
  description?: string | null;
};

export type UpdateManagedCategoryInput = Partial<{
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  isStorefrontVisible: boolean;
  coverPosition: CategoryCoverPosition;
}>;

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }

  return searchParams.toString();
}

export async function fetchManagedCategories(
  query: CategoryListQuery = {},
  options: Pick<RequestInit, "signal"> = {}
): Promise<{ items: ManagedCategoryRecord[]; meta: PaginationMeta }> {
  const queryString = buildQueryString(query);
  const response = await apiClient.request<ManagedCategoryRecord[], never, PaginationMeta>(
    `/api/catalog/categories${queryString ? `?${queryString}` : ""}`,
    options
  );

  if (!response.success || !response.data) {
    throw new Error(response.message || "Categories could not be loaded.");
  }

  return {
    items: response.data,
    meta: response.meta ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      totalItems: response.data.length,
      totalPages: response.data.length > 0 ? 1 : 0
    }
  };
}

export async function fetchManagedCategory(
  categoryId: string,
  options: Pick<RequestInit, "signal"> = {}
) {
  const response = await apiClient.request<ManagedCategoryRecord, { code?: string }>(
    `/api/catalog/categories/${encodeURIComponent(categoryId)}`,
    options
  );

  if (!response.success || !response.data) {
    throw new Error(response.message || "Category could not be loaded.");
  }

  return response.data;
}

export async function createManagedCategory(input: CreateManagedCategoryInput) {
  return apiClient.request<ManagedCategoryRecord, { code?: string; details?: unknown }>(
    "/api/catalog/categories",
    {
      method: "POST",
      json: input
    }
  );
}

export async function updateManagedCategory(
  categoryId: string,
  input: UpdateManagedCategoryInput
) {
  return apiClient.request<ManagedCategoryRecord, { code?: string; details?: unknown }>(
    `/api/catalog/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "PATCH",
      json: input
    }
  );
}

export function getPublicCategoryCoverUrl(
  imageId: string,
  variant: "cover" | "thumbnail" = "cover"
) {
  return resolveApiUrl(
    `/api/storefront/category-images/${encodeURIComponent(imageId)}/${variant}`
  ).toString();
}
