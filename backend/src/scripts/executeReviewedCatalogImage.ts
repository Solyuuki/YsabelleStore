import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../database/prismaClient.js";
import {
  materializeCatalogDriveImages,
  type CatalogDriveMaterializationPlanRow
} from "../modules/catalog/catalog-image-drive-materialization.js";
import { reconcileCatalogImages } from "../modules/catalog/catalog-image-reconciliation.js";
import { buildReviewedCatalogImageExecutionTarget } from "../modules/catalog/catalog-reviewed-image-execution.js";
import type { DriveImageAsset } from "../modules/catalog/drive-image-manifest.js";
import {
  normalizeSarimaSourceName,
  type SarimaSourceIdentity
} from "../modules/catalog/sarima-source-manifest.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";
import { runCatalogImageEngine } from "../modules/catalog-image/catalogImageEngineRunner.js";
import {
  approveProductImageCandidate,
  createProductImageCandidate
} from "../modules/catalog-image/productImageService.js";

const SOURCE_MANIFEST_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/sarima-source-manifest.json"
);
const DRIVE_MANIFEST_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/drive-image-manifest.json"
);

async function readJsonArray<T>(filePath: string, label: string): Promise<T[]> {
  const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`CATALOG_REVIEWED_IMAGE_INVALID_${label}: expected JSON array at ${filePath}`);
  }
  return parsed as T[];
}

function parseArguments(argv: string[]) {
  const productCodeFlag = argv.find((arg) => arg.startsWith("--product-code="));
  const productCode = productCodeFlag?.split("=", 2)[1]?.trim().toUpperCase() ?? "";
  const apply = argv.includes("--apply");

  if (!/^P\d{3}$/.test(productCode)) {
    throw new Error(
      "CATALOG_REVIEWED_IMAGE_PRODUCT_CODE_REQUIRED: pass --product-code=P###"
    );
  }

  return { productCode, apply };
}

export async function executeReviewedCatalogImage(options: {
  productCode: string;
  apply: boolean;
  repositoryRoot?: string;
}) {
  const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
  const [sources, images] = await Promise.all([
    readJsonArray<SarimaSourceIdentity>(SOURCE_MANIFEST_PATH, "SOURCE_MANIFEST"),
    readJsonArray<DriveImageAsset>(DRIVE_MANIFEST_PATH, "DRIVE_MANIFEST")
  ]);
  const reconciliation = reconcileCatalogImages(sources, images);
  const target = buildReviewedCatalogImageExecutionTarget({
    productCode: options.productCode,
    sources,
    images,
    reconciliation
  });

  const product = await prisma.product.findUnique({
    select: {
      id: true,
      sku: true,
      name: true,
      imageUrl: true,
      activeImageAssetId: true,
      category: { select: { name: true } }
    },
    where: { sku: target.expectedSku }
  });

  if (!product) {
    throw new Error(`CATALOG_REVIEWED_IMAGE_PRODUCT_MISSING: ${target.expectedSku}`);
  }
  if (normalizeSarimaSourceName(product.name) !== target.sourceNameNormalized) {
    throw new Error(
      `CATALOG_REVIEWED_IMAGE_PRODUCT_NAME_MISMATCH: ${target.expectedSku} is ${product.name}`
    );
  }
  if (product.category.name !== target.category) {
    throw new Error(
      `CATALOG_REVIEWED_IMAGE_PRODUCT_CATEGORY_MISMATCH: ${target.expectedSku} is in ${product.category.name}`
    );
  }

  if (product.activeImageAssetId || product.imageUrl) {
    if (product.activeImageAssetId && product.imageUrl) {
      return {
        productCode: target.productCode,
        sku: product.sku,
        status: "ALREADY_CONFIGURED" as const,
        imageUrl: product.imageUrl,
        activeImageAssetId: product.activeImageAssetId
      };
    }
    throw new Error(
      `CATALOG_REVIEWED_IMAGE_PARTIAL_STATE: ${target.expectedSku} has only one active image field populated`
    );
  }

  const workingRoot = await fs.mkdtemp(path.join(os.tmpdir(), `ysabelle-${target.productCode}-`));
  const extension = target.extension.startsWith(".") ? target.extension : `.${target.extension}`;
  const sourcePath = path.join("source", `image${extension}`);
  const plan: CatalogDriveMaterializationPlanRow[] = [
    {
      productCode: target.productCode,
      fileId: target.fileId,
      filename: target.filename,
      mimeType: target.mimeType,
      sourcePath,
      downloadUrl: `https://drive.usercontent.google.com/download?id=${encodeURIComponent(target.fileId)}&export=download&confirm=t`
    }
  ];

  try {
    const [materialized] = await materializeCatalogDriveImages({
      plan,
      repositoryRoot: workingRoot,
      maxAttempts: 2
    });
    if (!materialized?.usable || !materialized.contentType) {
      throw new Error(
        `CATALOG_REVIEWED_IMAGE_DOWNLOAD_FAILED: ${target.productCode} ${materialized?.error ?? "unknown error"}`
      );
    }

    const absoluteSourcePath = path.join(workingRoot, sourcePath);
    const preflightOutput = path.join(workingRoot, "preflight");
    await fs.mkdir(preflightOutput, { recursive: true });
    const preflight = await runCatalogImageEngine(absoluteSourcePath, preflightOutput);
    if (preflight.status !== "APPROVED" || !preflight.variants) {
      throw new Error(
        `CATALOG_REVIEWED_IMAGE_QUALITY_REJECTED: ${target.productCode} returned ${preflight.status}`
      );
    }

    if (!options.apply) {
      return {
        productCode: target.productCode,
        sku: product.sku,
        status: "DRY_RUN_APPROVED" as const,
        fileId: target.fileId,
        filename: target.filename,
        contentType: materialized.contentType,
        sha256: materialized.sha256,
        diagnostics: preflight.diagnostics
      };
    }

    const bytes = await fs.readFile(absoluteSourcePath);
    const candidate = await createProductImageCandidate(product.id, {
      buffer: bytes,
      mimetype: materialized.contentType,
      originalname: target.filename,
      size: bytes.length
    });

    if (
      candidate.processingStatus !== "READY" ||
      candidate.qualityStatus !== "APPROVED" ||
      !candidate.cardStorageKey ||
      !candidate.processedStorageKey ||
      !candidate.pdpStorageKey
    ) {
      throw new Error(
        `CATALOG_REVIEWED_IMAGE_CANDIDATE_NOT_APPROVABLE: ${target.productCode} candidate ${candidate.id}`
      );
    }

    await approveProductImageCandidate(product.id, candidate.id);
    const updated = await prisma.product.findUniqueOrThrow({
      select: { activeImageAssetId: true, imageUrl: true, sku: true },
      where: { id: product.id }
    });

    if (updated.activeImageAssetId !== candidate.id || !updated.imageUrl) {
      throw new Error(
        `CATALOG_REVIEWED_IMAGE_POSTCONDITION_FAILED: ${target.productCode} did not receive the approved storefront URL`
      );
    }

    return {
      productCode: target.productCode,
      sku: updated.sku,
      status: "APPLIED" as const,
      imageAssetId: candidate.id,
      imageUrl: updated.imageUrl
    };
  } finally {
    await fs.rm(workingRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const args = parseArguments(process.argv.slice(2));
  const result = await executeReviewedCatalogImage({
    productCode: args.productCode,
    apply: args.apply
  });
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}
