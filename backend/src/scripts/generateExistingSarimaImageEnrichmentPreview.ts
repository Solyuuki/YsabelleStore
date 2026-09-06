import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../database/prismaClient.js";
import {
  buildExistingSarimaImageEnrichmentPreview,
  type ExistingSarimaImageProduct,
  type ExistingSarimaImageEnrichmentPreview
} from "../modules/catalog/catalog-existing-sarima-image-enrichment-preview.js";
import {
  EXISTING_SARIMA_REHABILITATION_IDENTITIES,
  type ExistingSarimaPromotionEvidence
} from "../modules/catalog/catalog-existing-sarima-rehabilitation-readiness.js";
import type { DriveImageAsset } from "../modules/catalog/drive-image-manifest.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_PROMOTION_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/catalog-promotion-preview.json"
);
const DEFAULT_DRIVE_MANIFEST_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/drive-image-manifest.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-existing-sarima-image-enrichment-preview.json"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-existing-sarima-image-enrichment-preview.md"
);

type RawProductRow = {
  id: string;
  sku: string;
  name: string;
  recordSource: string;
  status: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  activeImageAssetId: string | null;
  sarimaSourceMapping: { sourceProductId: string } | null;
  imageAssets: Array<{
    id: string;
    qualityStatus: string;
    processingStatus: string;
    originalStorageKey: string;
    diagnostics: unknown;
  }>;
};

export type ExistingSarimaImageEnrichmentPrismaClient = {
  product: {
    findMany(args: unknown): Promise<RawProductRow[]>;
  };
};

type PromotionArtifact = { rows: ExistingSarimaPromotionEvidence[] };

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

function toProduct(row: RawProductRow): ExistingSarimaImageProduct {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    recordSource: row.recordSource,
    status: row.status,
    dataQualityStatus: row.dataQualityStatus,
    isStorefrontVisible: row.isStorefrontVisible,
    sarimaSourceProductId: row.sarimaSourceMapping?.sourceProductId ?? null,
    activeImageAssetId: row.activeImageAssetId,
    imageAssets: row.imageAssets
  };
}

function toMarkdown(preview: ExistingSarimaImageEnrichmentPreview) {
  return [
    "# Phase 9 Existing SARIMA Image Enrichment Preview",
    "",
    "**READ-ONLY.** No ProductImageAsset, Product, barcode, price, inventory, or quality-state mutations are performed.",
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Products | ${preview.summary.products} |`,
    `| Exact-match candidates | ${preview.summary.exactMatchCandidates} |`,
    `| Ready: create engine asset | ${preview.summary.readyCreateEngineAsset} |`,
    `| Ready: reuse engine asset | ${preview.summary.readyReuseEngineAsset} |`,
    `| Blocked: needs review | ${preview.summary.blockedNeedsReview} |`,
    `| Blocked: variant/size mismatch | ${preview.summary.blockedVariantSizeMismatch} |`,
    `| Blocked: duplicate image | ${preview.summary.blockedDuplicateImage} |`,
    `| Blocked: missing image | ${preview.summary.blockedMissingImage} |`,
    `| Cross-product Drive-file conflicts | ${preview.summary.crossProductFileIdConflicts} |`,
    `| Existing DB image assets | ${preview.summary.existingDatabaseImageAssets} |`,
    `| Existing active images | ${preview.summary.existingActiveImages} |`,
    "",
    "## Products",
    "",
    "| SARIMA | Product | Engine status | Preview status | Proposed action | Drive file IDs | Existing DB assets |",
    "| --- | --- | --- | --- | --- | --- | ---: |",
    ...preview.rows.map(
      (row) =>
        `| ${row.sarimaSourceProductId} | ${row.name.replaceAll("|", "\\|")} | ${row.catalogImageStatus} | ${row.status} | ${row.proposedAction} | ${row.catalogImageFileIds.join(", ") || "—"} | ${row.existingImageAssetIds.length} |`
    ),
    "",
    "Only Catalog Image Engine EXACT_MATCH rows can become write candidates. Existing DB images are reusable only when diagnostics explicitly retain the same source Drive file ID.",
    ""
  ].join("\n");
}

async function writeText(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateExistingSarimaImageEnrichmentPreview(
  options: {
    client?: ExistingSarimaImageEnrichmentPrismaClient;
    promotionPath?: string;
    driveManifestPath?: string;
    jsonPath?: string;
    reportPath?: string;
  } = {}
) {
  const client = options.client ?? (prisma as unknown as ExistingSarimaImageEnrichmentPrismaClient);
  const promotionPath = options.promotionPath ?? DEFAULT_PROMOTION_PATH;
  const driveManifestPath = options.driveManifestPath ?? DEFAULT_DRIVE_MANIFEST_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const identities = EXISTING_SARIMA_REHABILITATION_IDENTITIES;
  const productIds = identities.map((row) => row.id);
  const sourceCodes = new Set<string>(identities.map((row) => row.sarimaSourceProductId));

  const [productRows, promotionArtifact, driveAssets] = await Promise.all([
    client.product.findMany({
      where: { id: { in: productIds } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        recordSource: true,
        status: true,
        dataQualityStatus: true,
        isStorefrontVisible: true,
        activeImageAssetId: true,
        sarimaSourceMapping: { select: { sourceProductId: true } },
        imageAssets: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            qualityStatus: true,
            processingStatus: true,
            originalStorageKey: true,
            diagnostics: true
          }
        }
      }
    }),
    readJson<PromotionArtifact>(promotionPath),
    readJson<DriveImageAsset[]>(driveManifestPath)
  ]);

  if (!promotionArtifact || !Array.isArray(promotionArtifact.rows)) {
    throw new Error(
      `EXISTING_SARIMA_IMAGE_ENRICHMENT_INVALID_PROMOTION_ARTIFACT: ${promotionPath}`
    );
  }
  if (!Array.isArray(driveAssets)) {
    throw new Error(
      `EXISTING_SARIMA_IMAGE_ENRICHMENT_INVALID_DRIVE_MANIFEST: ${driveManifestPath}`
    );
  }

  const preview = buildExistingSarimaImageEnrichmentPreview({
    identities,
    products: productRows.map(toProduct),
    promotionRows: promotionArtifact.rows.filter((row) => sourceCodes.has(row.productCode)),
    driveAssets
  });

  await Promise.all([
    writeText(jsonPath, `${JSON.stringify(preview, null, 2)}\n`),
    writeText(reportPath, `${toMarkdown(preview)}\n`)
  ]);

  return preview;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return (
    Boolean(entryPoint) &&
    path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url))
  );
}

if (isDirectExecution()) {
  try {
    const preview = await generateExistingSarimaImageEnrichmentPreview();
    console.log(JSON.stringify(preview, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
