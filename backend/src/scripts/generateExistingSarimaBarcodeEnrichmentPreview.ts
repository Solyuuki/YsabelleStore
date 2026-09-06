import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../database/prismaClient.js";
import {
  buildExistingSarimaBarcodeEnrichmentPreview,
  type BarcodeOwner,
  type ExistingSarimaBarcodeEnrichmentPreview
} from "../modules/catalog/catalog-existing-sarima-barcode-enrichment-preview.js";
import {
  EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITIES,
  type ExistingSarimaBarcodeProduct
} from "../modules/catalog/catalog-existing-sarima-barcode-evidence.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";
import { buildBarcodeEvidenceForProducts } from "./generateExistingSarimaBarcodeEvidence.js";

const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-existing-sarima-barcode-enrichment-preview.json"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-existing-sarima-barcode-enrichment-preview.md"
);

type RawProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  recordSource: string;
  status: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  sarimaSourceMapping: { sourceProductId: string } | null;
};

type RawBarcodeOwner = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
};

export type BarcodeEnrichmentPreviewPrismaClient = {
  product: {
    findMany(args: unknown): Promise<RawProduct[] | RawBarcodeOwner[]>;
  };
};

function toTargetProduct(row: RawProduct): ExistingSarimaBarcodeProduct {
  const sarimaSourceProductId = row.sarimaSourceMapping?.sourceProductId;
  if (!sarimaSourceProductId) {
    throw new Error(
      `EXISTING_SARIMA_BARCODE_ENRICHMENT_IDENTITY_MISMATCH: ${row.id} has no SARIMA source mapping`
    );
  }
  return {
    id: row.id,
    sku: row.sku,
    sarimaSourceProductId,
    name: row.name,
    barcode: row.barcode,
    recordSource: row.recordSource,
    status: row.status,
    dataQualityStatus: row.dataQualityStatus,
    isStorefrontVisible: row.isStorefrontVisible
  };
}

function toMarkdown(preview: ExistingSarimaBarcodeEnrichmentPreview) {
  const lines = [
    "# Phase 9 Existing SARIMA Barcode Enrichment Preview",
    "",
    "**READ-ONLY.** This preview does not modify Product.barcode or any other database field.",
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Verified candidates | ${preview.summary.verifiedCandidates} |`,
    `| Ready to write | ${preview.summary.readyToWrite} |`,
    `| Blocked barcode collisions | ${preview.summary.blockedBarcodeCollisions} |`,
    `| Planned barcode writes | ${preview.summary.plannedBarcodeWrites} |`,
    "",
    "## Proposed barcode writes",
    "",
    "| SARIMA | SKU | Product | Proposed barcode | Status | Collision Product IDs |",
    "| --- | --- | --- | --- | --- | --- |",
    ...preview.rows.map(
      (row) =>
        `| ${row.sarimaSourceProductId} | ${row.sku} | ${row.name.replaceAll("|", "\\|")} | ${row.proposedBarcode} | ${row.status} | ${row.collisionProductIds.join(", ") || "-"} |`
    ),
    "",
    "Only VERIFIED_EXTERNAL evidence is eligible. Any existing Product owner or duplicate proposed barcode blocks that row.",
    ""
  ];
  return lines.join("\n");
}

async function writeText(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateExistingSarimaBarcodeEnrichmentPreview(
  options: {
    client?: BarcodeEnrichmentPreviewPrismaClient;
    jsonPath?: string;
    reportPath?: string;
  } = {}
) {
  const client = options.client ?? (prisma as unknown as BarcodeEnrichmentPreviewPrismaClient);
  const ids = EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITIES.map((row) => row.id);

  const rawTargets = (await client.product.findMany({
    where: { id: { in: ids } },
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
      sarimaSourceMapping: { select: { sourceProductId: true } }
    }
  })) as RawProduct[];

  if (rawTargets.length !== ids.length) {
    throw new Error(
      `EXISTING_SARIMA_BARCODE_ENRICHMENT_IDENTITY_MISMATCH: expected ${ids.length} products, found ${rawTargets.length}`
    );
  }

  const products = rawTargets.map(toTargetProduct);
  const evidence = buildBarcodeEvidenceForProducts(products);
  const verifiedBarcodes = evidence.rows
    .filter((row) => row.status === "VERIFIED_EXTERNAL" && row.verifiedBarcode)
    .map((row) => row.verifiedBarcode!);

  const rawOwners = (await client.product.findMany({
    where: { barcode: { in: verifiedBarcodes } },
    orderBy: { id: "asc" },
    select: { id: true, sku: true, name: true, barcode: true }
  })) as RawBarcodeOwner[];

  const barcodeOwners: BarcodeOwner[] = rawOwners
    .filter((row): row is RawBarcodeOwner & { barcode: string } => Boolean(row.barcode))
    .map((row) => ({ id: row.id, sku: row.sku, name: row.name, barcode: row.barcode }));

  const preview = buildExistingSarimaBarcodeEnrichmentPreview({
    products,
    evidence,
    barcodeOwners
  });
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

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
    const preview = await generateExistingSarimaBarcodeEnrichmentPreview();
    console.log(JSON.stringify(preview, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
