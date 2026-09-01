import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCatalogPromotionPreview,
  type CatalogPromotionPreview
} from "../modules/catalog/catalog-promotion-preview.js";
import type { CatalogImageReconciliation } from "../modules/catalog/catalog-image-reconciliation.js";
import type { SarimaSourceIdentity } from "../modules/catalog/sarima-source-manifest.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_SARIMA_MANIFEST_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/sarima-source-manifest.json"
);
const DEFAULT_RECONCILIATION_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/image-reconciliation.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/catalog-promotion-preview.json"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-catalog-promotion-preview.md"
);

type ReconciliationArtifact = {
  reconciliation: CatalogImageReconciliation;
};

export type GenerateCatalogPromotionPreviewOptions = {
  sarimaManifestPath?: string;
  reconciliationPath?: string;
  jsonPath?: string;
  reportPath?: string;
};

async function readJson<T>(filePath: string, label: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${filePath}.`, { cause: error });
  }
}

async function writeTextFile(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

function toMarkdown(preview: CatalogPromotionPreview) {
  const aliases = preview.rows.filter((row) => row.identityStatus === "DUPLICATE_ALIAS");
  const blocked = preview.rows.filter((row) => row.identityStatus === "BLOCKED_REVIEW");
  const imageReview = preview.rows.filter(
    (row) =>
      row.identityStatus === "CANONICAL" &&
      ["NEEDS_REVIEW", "VARIANT_SIZE_MISMATCH", "DUPLICATE_IMAGE"].includes(row.imageStatus)
  );
  const missingImages = preview.rows.filter(
    (row) => row.identityStatus === "CANONICAL" && row.imageStatus === "MISSING_IMAGE"
  );

  const lines = [
    "# Phase 9 Catalog Promotion Preview",
    "",
    "This is a dry-run identity preview only. No Product, Inventory, InventoryBatch, price, or stock data was modified.",
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| SARIMA source identities | ${preview.sourceIdentityCount} |`,
    `| Canonical identity candidates | ${preview.canonicalIdentityCount} |`,
    `| Duplicate aliases | ${preview.duplicateAliasCount} |`,
    `| Identity-blocked for review | ${preview.blockedIdentityCount} |`,
    `| Canonical candidates with image review/mismatch/duplicate | ${imageReview.length} |`,
    `| Canonical candidates with missing image | ${missingImages.length} |`,
    "",
    "Current price and physical inventory remain unverified for every promotion candidate. Operational NEW/EXISTING classification requires a live database audit and is intentionally not guessed here.",
    "",
    "## Duplicate Aliases",
    "",
    ...(aliases.length > 0
      ? aliases.map(
          (row) =>
            `- ${row.productCode} — ${row.sourceName} → canonical candidate ${row.canonicalProductCode}`
        )
      : ["- None"]),
    "",
    "## Identity Review Blockers",
    "",
    ...(blocked.length > 0
      ? blocked.map(
          (row) =>
            `- ${row.productCode} — ${row.sourceName} → related canonical candidate ${row.canonicalProductCode}`
        )
      : ["- None"]),
    "",
    "## Image-Readiness Exceptions on Canonical Candidates",
    "",
    ...(imageReview.length > 0
      ? imageReview.map(
          (row) => `- ${row.productCode} — ${row.sourceName} — ${row.imageStatus}`
        )
      : ["- None"]),
    "",
    "## Missing Images on Canonical Candidates",
    "",
    ...(missingImages.length > 0
      ? missingImages.map((row) => `- ${row.productCode} — ${row.sourceName}`)
      : ["- None"]),
    ""
  ];

  return lines.join("\n");
}

export async function generateCatalogPromotionPreview(
  options: GenerateCatalogPromotionPreviewOptions = {}
): Promise<CatalogPromotionPreview> {
  const sarimaManifestPath = options.sarimaManifestPath ?? DEFAULT_SARIMA_MANIFEST_PATH;
  const reconciliationPath = options.reconciliationPath ?? DEFAULT_RECONCILIATION_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const sources = await readJson<SarimaSourceIdentity[]>(sarimaManifestPath, "SARIMA manifest");
  if (!Array.isArray(sources)) {
    throw new Error(`SARIMA manifest must contain a JSON array: ${sarimaManifestPath}.`);
  }

  const artifact = await readJson<ReconciliationArtifact>(
    reconciliationPath,
    "image reconciliation artifact"
  );
  if (!artifact?.reconciliation) {
    throw new Error(`Image reconciliation artifact is missing reconciliation data: ${reconciliationPath}.`);
  }

  const preview = buildCatalogPromotionPreview(sources, artifact.reconciliation);

  await Promise.all([
    writeTextFile(jsonPath, `${JSON.stringify(preview, null, 2)}\n`),
    writeTextFile(reportPath, toMarkdown(preview))
  ]);

  return preview;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  if (!entryPoint) return false;

  return path.resolve(entryPoint) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const preview = await generateCatalogPromotionPreview();
  console.log(
    JSON.stringify(
      {
        sourceIdentityCount: preview.sourceIdentityCount,
        canonicalIdentityCount: preview.canonicalIdentityCount,
        duplicateAliasCount: preview.duplicateAliasCount,
        blockedIdentityCount: preview.blockedIdentityCount
      },
      null,
      2
    )
  );
}
