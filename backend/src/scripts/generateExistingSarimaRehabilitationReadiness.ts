import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../database/prismaClient.js";
import {
  EXISTING_SARIMA_REHABILITATION_IDENTITIES,
  buildExistingSarimaRehabilitationReadiness,
  type ExistingSarimaPromotionEvidence,
  type ExistingSarimaRehabilitationProduct,
  type ExistingSarimaRehabilitationReadiness
} from "../modules/catalog/catalog-existing-sarima-rehabilitation-readiness.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_PROMOTION_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/catalog-promotion-preview.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-existing-sarima-rehabilitation-readiness.json"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-existing-sarima-rehabilitation-readiness.md"
);

type PromotionArtifact = { rows: ExistingSarimaPromotionEvidence[] };

type RawProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  recordSource: string;
  status: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  sarimaSourceMapping: { sourceProductId: string } | null;
  _count: { imageAssets: number };
};

export type ExistingSarimaRehabilitationPrismaClient = {
  product: {
    findMany(args: unknown): Promise<RawProductRow[]>;
  };
};

export type GenerateExistingSarimaRehabilitationReadinessOptions = {
  client?: ExistingSarimaRehabilitationPrismaClient;
  promotionPath?: string;
  jsonPath?: string;
  reportPath?: string;
};

async function readPromotionArtifact(filePath: string): Promise<PromotionArtifact> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as PromotionArtifact;
  if (!parsed || !Array.isArray(parsed.rows)) {
    throw new Error(`EXISTING_SARIMA_REHABILITATION_INVALID_PROMOTION_ARTIFACT: ${filePath}`);
  }
  return parsed;
}

function toProduct(row: RawProductRow): ExistingSarimaRehabilitationProduct {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    recordSource: row.recordSource,
    status: row.status,
    dataQualityStatus: row.dataQualityStatus,
    isStorefrontVisible: row.isStorefrontVisible,
    sarimaSourceProductId: row.sarimaSourceMapping?.sourceProductId ?? null,
    existingImageAssetCount: row._count.imageAssets
  };
}

function toMarkdown(matrix: ExistingSarimaRehabilitationReadiness) {
  const lines = [
    "# Phase 9 Existing SARIMA Rehabilitation Readiness",
    "",
    "**READ-ONLY.** This matrix does not modify Product, barcode, images, SARIMA mappings, price, inventory, or quality state.",
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Products | ${matrix.summary.products} |`,
    `| Barcode missing | ${matrix.summary.barcodeMissing} |`,
    `| Barcode present but unverified | ${matrix.summary.barcodePresentUnverified} |`,
    `| Identity clear | ${matrix.summary.identityClear} |`,
    `| Identity blocked | ${matrix.summary.identityBlocked} |`,
    `| Image exact match | ${matrix.summary.imageExactMatch} |`,
    `| Image needs review | ${matrix.summary.imageNeedsReview} |`,
    `| Image variant/size mismatch | ${matrix.summary.imageVariantSizeMismatch} |`,
    `| Image duplicate | ${matrix.summary.imageDuplicate} |`,
    `| Image missing | ${matrix.summary.imageMissing} |`,
    `| Existing database image assets | ${matrix.summary.databaseImageAssets} |`,
    `| Catalog Image Engine candidate assets | ${matrix.summary.catalogImageCandidateAssets} |`,
    "",
    "## Products",
    "",
    "| SARIMA | SKU | Product | Barcode readiness | DB images | Image Engine | Identity | Canonical |",
    "| --- | --- | --- | --- | ---: | --- | --- | --- |",
    ...matrix.rows.map(
      (row) =>
        `| ${row.sarimaSourceProductId} | ${row.sku} | ${row.name.replaceAll("|", "\\|")} | ${row.barcodeReadiness} | ${row.existingImageAssetCount} | ${row.catalogImageStatus} | ${row.identityReadiness} | ${row.canonicalProductCode} |`
    ),
    "",
    "Barcode presence is evidence only and is never treated as verified without an approved external/physical source. Existing database images are counted separately from Catalog Image Engine reconciliation evidence.",
    ""
  ];
  return lines.join("\n");
}

async function writeText(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateExistingSarimaRehabilitationReadiness(
  options: GenerateExistingSarimaRehabilitationReadinessOptions = {}
) {
  const client = options.client ?? (prisma as unknown as ExistingSarimaRehabilitationPrismaClient);
  const promotionPath = options.promotionPath ?? DEFAULT_PROMOTION_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const identities = EXISTING_SARIMA_REHABILITATION_IDENTITIES;
  const productIds = identities.map((row) => row.id);
  const sourceCodes = new Set(identities.map((row) => row.sarimaSourceProductId));

  const [productRows, promotionArtifact] = await Promise.all([
    client.product.findMany({
      where: { id: { in: productIds } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        recordSource: true,
        status: true,
        dataQualityStatus: true,
        isStorefrontVisible: true,
        sarimaSourceMapping: { select: { sourceProductId: true } },
        _count: { select: { imageAssets: true } }
      }
    }),
    readPromotionArtifact(promotionPath)
  ]);

  const matrix = buildExistingSarimaRehabilitationReadiness({
    identities,
    products: productRows.map(toProduct),
    promotionRows: promotionArtifact.rows.filter((row) => sourceCodes.has(row.productCode))
  });

  await Promise.all([
    writeText(jsonPath, `${JSON.stringify(matrix, null, 2)}\n`),
    writeText(reportPath, `${toMarkdown(matrix)}\n`)
  ]);

  return matrix;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  try {
    const matrix = await generateExistingSarimaRehabilitationReadiness();
    console.log(JSON.stringify(matrix, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
