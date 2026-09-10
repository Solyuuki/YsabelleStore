import { apiClient } from "@/services/apiClient";
import type {
  ProductImportIssue,
  ProductImportPreview,
  ProductImportSummary
} from "@/services/catalogApi";

export type ProductPackageArchiveType =
  | "zip"
  | "rar"
  | "7z"
  | "tar"
  | "tar.gz"
  | "tgz"
  | "tar.bz2"
  | "tar.xz";

export type ProductPackageMetadata = {
  sourceType: "ARCHIVE" | "GOOGLE_DRIVE";
  packageFileName: string;
  archiveType: ProductPackageArchiveType;
  extractionEngine: string;
  filesScanned: number;
  foldersScanned: number;
  dataFileName: string;
  imagesFound: number;
  imagesMatched: number;
  imagesApproved: number;
  unmatchedImages: number;
  ignoredFiles: number;
  stagesCompleted: string[];
};

export type ProductPackagePreview = ProductImportPreview & {
  package: ProductPackageMetadata;
};

export type ProductPackageSummary = ProductImportSummary & {
  package: ProductPackageMetadata;
  imagesImported: number;
};

export type ProductPackageApiError = {
  code?: string;
  details?: unknown;
};

export async function previewLocalProductPackage(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  return apiClient.request<ProductPackagePreview, ProductPackageApiError>(
    "/api/catalog/products/import/preview",
    { method: "POST", formData }
  );
}

export async function importLocalProductPackage(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  return apiClient.request<ProductPackageSummary, ProductPackageApiError>(
    "/api/catalog/products/import",
    { method: "POST", formData }
  );
}

export async function previewGoogleDriveProductPackage(url: string) {
  return apiClient.request<ProductPackagePreview, ProductPackageApiError>(
    "/api/catalog/products/import/google-drive/preview",
    { method: "POST", json: { url } }
  );
}

export async function importGoogleDriveProductPackage(url: string) {
  return apiClient.request<ProductPackageSummary, ProductPackageApiError>(
    "/api/catalog/products/import/google-drive",
    { method: "POST", json: { url } }
  );
}

export function collectProductPackageIssues(preview: ProductPackagePreview | null) {
  if (!preview) return [] as ProductImportIssue[];
  return preview.errors;
}
