import { resolveApiUrl } from "@/config/runtime";
import { apiClient } from "@/services/apiClient";
import { getStoredAuthToken } from "@/services/authStorage";

export type CategoryImageQualityStatus = "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
export type CategoryImageProcessingStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type CategoryImagePreviewVariant = "original" | "processed" | "cover" | "thumbnail";

export type CategoryImageDiagnostic = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type CategoryImageCandidate = {
  id: string;
  categoryId: string;
  qualityStatus: CategoryImageQualityStatus;
  processingStatus: CategoryImageProcessingStatus;
  sourceMimeType: string;
  sourceBytes: number;
  sourceWidth: number | null;
  sourceHeight: number | null;
  diagnostics: unknown;
  approvedAt: string | null;
  rejectedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function uploadCategoryCover(categoryId: string, file: File) {
  const formData = new FormData();
  formData.set("image", file);

  return apiClient.request<CategoryImageCandidate, { code?: string; details?: unknown }>(
    `/api/catalog/categories/${encodeURIComponent(categoryId)}/images`,
    {
      method: "POST",
      formData
    }
  );
}

export async function fetchLatestCategoryCoverCandidate(
  categoryId: string,
  signal?: AbortSignal
): Promise<CategoryImageCandidate | null> {
  const response = await apiClient.request<{ candidate: CategoryImageCandidate | null }>(
    `/api/catalog/categories/${encodeURIComponent(categoryId)}/images/latest`,
    { signal }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message || "Latest category cover candidate could not be loaded.");
  }

  return response.data.candidate;
}

export async function approveCategoryCover(categoryId: string, imageId: string) {
  return apiClient.request<CategoryImageCandidate, { code?: string; details?: unknown }>(
    `/api/catalog/categories/${encodeURIComponent(categoryId)}/images/${encodeURIComponent(imageId)}/approve`,
    { method: "POST" }
  );
}

export async function rejectCategoryCover(categoryId: string, imageId: string) {
  return apiClient.request<CategoryImageCandidate, { code?: string; details?: unknown }>(
    `/api/catalog/categories/${encodeURIComponent(categoryId)}/images/${encodeURIComponent(imageId)}/reject`,
    { method: "POST" }
  );
}

export async function removeActiveCategoryCover(categoryId: string) {
  return apiClient.request<unknown, { code?: string; details?: unknown }>(
    `/api/catalog/categories/${encodeURIComponent(categoryId)}/cover`,
    { method: "DELETE" }
  );
}

export async function fetchCategoryCoverPreviewBlob(
  categoryId: string,
  imageId: string,
  variant: CategoryImagePreviewVariant,
  signal?: AbortSignal
) {
  const token = getStoredAuthToken();
  const response = await fetch(
    resolveApiUrl(
      `/api/catalog/categories/${encodeURIComponent(categoryId)}/images/${encodeURIComponent(imageId)}/preview/${variant}`
    ),
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal
    }
  );

  if (!response.ok) {
    throw new Error(`Category cover preview failed with status ${response.status}.`);
  }

  return response.blob();
}

export function getCategoryImageDiagnostics(candidate: CategoryImageCandidate) {
  if (!Array.isArray(candidate.diagnostics)) return [];
  return candidate.diagnostics.filter(isCategoryImageDiagnostic);
}

function isCategoryImageDiagnostic(value: unknown): value is CategoryImageDiagnostic {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CategoryImageDiagnostic>;

  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    (candidate.severity === "info" ||
      candidate.severity === "warning" ||
      candidate.severity === "error")
  );
}
