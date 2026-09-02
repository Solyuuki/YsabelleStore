import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { ExistingSarimaImageEnrichmentPreviewRow } from "./catalog-existing-sarima-image-enrichment-preview.js";
import type { DriveImageAsset } from "./drive-image-manifest.js";

export type CatalogDriveMaterializationPlanRow = {
  productCode: string;
  fileId: string;
  filename: string;
  mimeType: string;
  sourcePath: string;
  downloadUrl: string;
};

export type CatalogDriveMaterializationResult = {
  productCode: string;
  fileId: string;
  sourcePath: string;
  usable: boolean;
  sha256: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  attempts: number;
  error: string | null;
};

export type CatalogDriveDownloader = (
  url: string
) => Promise<{ bytes: Buffer; contentType: string | null }>;

function normalizedExtension(asset: DriveImageAsset) {
  const fromManifest = asset.extension.trim().toLowerCase();
  if (fromManifest.startsWith(".") && fromManifest.length > 1) return fromManifest;
  const fromFilename = path.extname(asset.filename).toLowerCase();
  if (fromFilename) return fromFilename;
  throw new Error(
    `CATALOG_IMAGE_DRIVE_MATERIALIZATION_EXTENSION_MISSING: ${asset.fileId} has no file extension`
  );
}

function detectSupportedImageContentType(bytes: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function resolveDownloadedContentType(bytes: Buffer, contentType: string | null) {
  const normalized = contentType?.toLowerCase() ?? null;
  if (normalized?.startsWith("image/")) return normalized;

  if (normalized === "application/octet-stream") {
    const detected = detectSupportedImageContentType(bytes);
    if (!detected) {
      throw new Error("octet-stream bytes are not a supported image");
    }
    return detected;
  }

  throw new Error(`non-image response content type ${normalized ?? "unknown"}`);
}

export function buildCatalogDriveMaterializationPlan(input: {
  rows: ExistingSarimaImageEnrichmentPreviewRow[];
  driveAssets: DriveImageAsset[];
}): CatalogDriveMaterializationPlanRow[] {
  const driveByFileId = new Map(input.driveAssets.map((asset) => [asset.fileId, asset]));

  return input.rows
    .filter(
      (row) =>
        row.catalogImageStatus === "EXACT_MATCH" &&
        row.status === "READY" &&
        row.proposedAction === "CREATE_ENGINE_ASSET"
    )
    .map((row) => {
      if (row.catalogImageFileIds.length !== 1) {
        throw new Error(
          `CATALOG_IMAGE_DRIVE_MATERIALIZATION_FILE_COUNT_MISMATCH: ${row.sarimaSourceProductId} expected exactly one Drive file`
        );
      }

      const fileId = row.catalogImageFileIds[0]!;
      const asset = driveByFileId.get(fileId);
      if (!asset) {
        throw new Error(
          `CATALOG_IMAGE_DRIVE_MATERIALIZATION_ASSET_MISSING: ${row.sarimaSourceProductId} references missing Drive file ${fileId}`
        );
      }
      if (!asset.mimeType.startsWith("image/")) {
        throw new Error(
          `CATALOG_IMAGE_DRIVE_MATERIALIZATION_MIME_MISMATCH: ${fileId} is ${asset.mimeType}`
        );
      }

      const extension = normalizedExtension(asset);
      return {
        productCode: row.sarimaSourceProductId,
        fileId,
        filename: asset.filename,
        mimeType: asset.mimeType,
        sourcePath: `.data/catalog-image-staging/${row.sarimaSourceProductId}/source${extension}`,
        downloadUrl: `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`
      };
    })
    .sort((left, right) => left.productCode.localeCompare(right.productCode));
}

export async function defaultCatalogDriveDownloader(
  url: string
): Promise<{ bytes: Buffer; contentType: string | null }> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    contentType: response.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? null
  };
}

export async function materializeCatalogDriveImages(input: {
  plan: CatalogDriveMaterializationPlanRow[];
  repositoryRoot: string;
  download?: CatalogDriveDownloader;
  maxAttempts?: number;
}): Promise<CatalogDriveMaterializationResult[]> {
  const download = input.download ?? defaultCatalogDriveDownloader;
  const maxAttempts = input.maxAttempts ?? 2;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new Error("CATALOG_IMAGE_DRIVE_MATERIALIZATION_INVALID_ATTEMPTS: maxAttempts must be an integer from 1 to 3");
  }

  const results: CatalogDriveMaterializationResult[] = [];

  for (const row of input.plan) {
    const absoluteSourcePath = path.resolve(input.repositoryRoot, row.sourcePath);
    let lastError: string | null = null;
    let completed = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const downloaded = await download(row.downloadUrl);
        if (downloaded.bytes.length === 0) {
          throw new Error("empty image response");
        }
        const contentType = resolveDownloadedContentType(downloaded.bytes, downloaded.contentType);

        await fs.mkdir(path.dirname(absoluteSourcePath), { recursive: true });
        await fs.writeFile(absoluteSourcePath, downloaded.bytes);

        results.push({
          productCode: row.productCode,
          fileId: row.fileId,
          sourcePath: row.sourcePath,
          usable: true,
          sha256: createHash("sha256").update(downloaded.bytes).digest("hex"),
          sizeBytes: downloaded.bytes.length,
          contentType,
          attempts: attempt,
          error: null
        });
        completed = true;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await fs.rm(absoluteSourcePath, { force: true }).catch(() => undefined);
      }
    }

    if (!completed) {
      results.push({
        productCode: row.productCode,
        fileId: row.fileId,
        sourcePath: row.sourcePath,
        usable: false,
        sha256: null,
        sizeBytes: null,
        contentType: null,
        attempts: maxAttempts,
        error: lastError
      });
    }
  }

  return results;
}
