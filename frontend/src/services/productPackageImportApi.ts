import { apiClient } from "@/services/apiClient";
import type {
  ProductImportPreview,
  ProductImportSummary
} from "@/services/catalogApi";

export const PRODUCT_PACKAGE_MAX_UPLOAD_MB = 100;

export const PRODUCT_PACKAGE_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".tar.gz",
  ".tgz",
  ".tar.bz2",
  ".tar.xz"
] as const;

export type ProductPackageSourceType = "ARCHIVE" | "GOOGLE_DRIVE";

export type ProductPackageMetadata = {
  sourceType: ProductPackageSourceType;
  packageFileName: string;
  archiveType: "zip" | "rar" | "7z" | "tar" | "tar.gz" | "tgz" | "tar.bz2" | "tar.xz";
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

export function isSupportedProductPackageName(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  return PRODUCT_PACKAGE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

export function getProductPackageTypeLabel(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const extension = PRODUCT_PACKAGE_EXTENSIONS.find((candidate) => normalized.endsWith(candidate));
  return extension ? extension.slice(1).toUpperCase() : "Package";
}

export async function previewLocalProductPackage(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return apiClient.request<ProductPackagePreview, { code?: string; details?: unknown }>(
    "/api/catalog/products/import/preview",
    {
      method: "POST",
      formData
    }
  );
}

export async function importLocalProductPackage(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return apiClient.request<ProductPackageSummary, { code?: string; details?: unknown }>(
    "/api/catalog/products/import",
    {
      method: "POST",
      formData
    }
  );
}

export async function previewGoogleDriveProductPackage(url: string) {
  return apiClient.request<ProductPackagePreview, { code?: string; details?: unknown }>(
    "/api/catalog/products/import/google-drive/preview",
    {
      method: "POST",
      json: { url }
    }
  );
}

export async function importGoogleDriveProductPackage(url: string) {
  return apiClient.request<ProductPackageSummary, { code?: string; details?: unknown }>(
    "/api/catalog/products/import/google-drive",
    {
      method: "POST",
      json: { url }
    }
  );
}
