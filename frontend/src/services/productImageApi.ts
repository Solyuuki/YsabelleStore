import { resolveApiUrl } from "@/config/runtime";
import { apiClient } from "@/services/apiClient";
import { getStoredAuthToken } from "@/services/authStorage";

export type ProductImageQualityStatus = "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
export type ProductImageProcessingStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type ProductImagePreviewVariant = "original" | "processed" | "card" | "pdp";

export type ProductImageDiagnostic = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type ProductImageCandidate = {
  id: string;
  productId: string;
  qualityStatus: ProductImageQualityStatus;
  processingStatus: ProductImageProcessingStatus;
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

export async function uploadProductImage(productId: string, file: File) {
  const formData = new FormData();
  formData.set("image", file);

  return apiClient.request<ProductImageCandidate, { code?: string; details?: unknown }>(
    `/api/catalog/products/${encodeURIComponent(productId)}/images`,
    {
      method: "POST",
      formData
    }
  );
}

export async function approveProductImage(productId: string, imageId: string) {
  return apiClient.request<ProductImageCandidate, { code?: string; details?: unknown }>(
    `/api/catalog/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}/approve`,
    { method: "POST" }
  );
}

export async function rejectProductImage(productId: string, imageId: string) {
  return apiClient.request<ProductImageCandidate, { code?: string; details?: unknown }>(
    `/api/catalog/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}/reject`,
    { method: "POST" }
  );
}

export async function fetchProductImagePreviewBlob(
  productId: string,
  imageId: string,
  variant: ProductImagePreviewVariant,
  signal?: AbortSignal
) {
  const token = getStoredAuthToken();
  const response = await fetch(
    resolveApiUrl(
      `/api/catalog/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}/preview/${variant}`
    ),
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal
    }
  );

  if (!response.ok) {
    throw new Error(`Product image preview failed with status ${response.status}.`);
  }

  return response.blob();
}

export function getProductImageDiagnostics(candidate: ProductImageCandidate) {
  if (!Array.isArray(candidate.diagnostics)) {
    return [];
  }

  return candidate.diagnostics.filter(isProductImageDiagnostic);
}

function isProductImageDiagnostic(value: unknown): value is ProductImageDiagnostic {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ProductImageDiagnostic>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    (candidate.severity === "info" ||
      candidate.severity === "warning" ||
      candidate.severity === "error")
  );
}
