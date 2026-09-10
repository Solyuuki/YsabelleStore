import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ExistingSarimaImageEnrichmentPreview } from "../modules/catalog/catalog-existing-sarima-image-enrichment-preview.js";
import type { ExistingSarimaPromotionEvidence } from "../modules/catalog/catalog-existing-sarima-rehabilitation-readiness.js";
import {
  buildCatalogImageEngineJobs,
  buildCatalogImageSourceSelection,
  type CatalogDriveImageMaterialization,
  type CatalogLicensedWebImageEvidence
} from "../modules/catalog/catalog-image-source-selection.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_PREVIEW_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-existing-sarima-image-enrichment-preview.json"
);
const DEFAULT_PROMOTION_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/catalog-promotion-preview.json"
);
const DEFAULT_DRIVE_MATERIALIZATIONS_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/image-source-drive-materializations.json"
);
const DEFAULT_WEB_EVIDENCE_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/image-source-web-evidence.json"
);
const DEFAULT_SELECTION_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-image-source-selection.json"
);
const DEFAULT_JOBS_PATH = resolveRepositoryPath("artifacts/catalog/phase9/image-engine-jobs.json");
const DEFAULT_REPORT_PATH = resolveRepositoryPath("docs/catalog/phase9-image-source-selection.md");

type PromotionArtifact = { rows: ExistingSarimaPromotionEvidence[] };

type CatalogImageSourceArtifactsInput = {
  preview: ExistingSarimaImageEnrichmentPreview;
  promotion: PromotionArtifact;
  driveMaterializations: CatalogDriveImageMaterialization[];
  webEvidence: CatalogLicensedWebImageEvidence[];
};

export function buildCatalogImageSourceArtifacts(input: CatalogImageSourceArtifactsInput) {
  if (!input.preview || !Array.isArray(input.preview.rows)) {
    throw new Error(
      "CATALOG_IMAGE_SOURCE_SELECTION_INVALID_PREVIEW: preview.rows must be an array"
    );
  }
  if (!input.promotion || !Array.isArray(input.promotion.rows)) {
    throw new Error(
      "CATALOG_IMAGE_SOURCE_SELECTION_INVALID_PROMOTION: promotion.rows must be an array"
    );
  }
  if (!Array.isArray(input.driveMaterializations)) {
    throw new Error(
      "CATALOG_IMAGE_SOURCE_SELECTION_INVALID_DRIVE_MATERIALIZATIONS: expected an array"
    );
  }
  if (!Array.isArray(input.webEvidence)) {
    throw new Error("CATALOG_IMAGE_SOURCE_SELECTION_INVALID_WEB_EVIDENCE: expected an array");
  }

  const selection = buildCatalogImageSourceSelection({
    rows: input.preview.rows,
    promotionRows: input.promotion.rows,
    driveMaterializations: input.driveMaterializations,
    webEvidence: input.webEvidence
  });

  return {
    selection,
    jobs: buildCatalogImageEngineJobs(selection)
  };
}

async function readRequiredJson<T>(filePath: string, code: string): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch (error) {
    throw new Error(`${code}: unable to read ${filePath}`, { cause: error });
  }
}

async function readOptionalArray<T>(filePath: string, code: string): Promise<T[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) throw new Error("expected JSON array");
    return parsed as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error(`${code}: unable to read ${filePath}`, { cause: error });
  }
}

async function writeText(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

function toMarkdown(artifacts: ReturnType<typeof buildCatalogImageSourceArtifacts>) {
  const { selection, jobs } = artifacts;
  return [
    "# Phase 9 Catalog Image Source Selection",
    "",
    "**NO DATABASE WRITE.** Source priority is Drive exact match first, then explicitly licensed exact web evidence when Drive is unavailable or unusable, then CIQE processing.",
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Products | ${selection.summary.products} |`,
    `| Ready from Drive | ${selection.summary.readyDrive} |`,
    `| Ready from licensed web | ${selection.summary.readyLicensedWeb} |`,
    `| Needs Drive materialization | ${selection.summary.needsDriveMaterialization} |`,
    `| Needs licensed web fallback | ${selection.summary.needsLicensedWebFallback} |`,
    `| Blocked identity review | ${selection.summary.blockedIdentityReview} |`,
    `| CIQE jobs | ${jobs.length} |`,
    "",
    "## Products",
    "",
    "| Product code | Product | Status | Source kind | Source reference | License basis |",
    "| --- | --- | --- | --- | --- | --- |",
    ...selection.rows.map(
      (row) =>
        `| ${row.productCode} | ${row.name.replaceAll("|", "\\|")} | ${row.status} | ${row.selectedSourceKind ?? "—"} | ${row.selectedSourceReference ?? "—"} | ${(row.licenseBasis ?? "—").replaceAll("|", "\\|")} |`
    ),
    "",
    "Retailer/public product pages without explicit commercial-use rights are never promoted to licensed-web sources. Identity-blocked products never enter CIQE.",
    ""
  ].join("\n");
}

export async function generateCatalogImageSourceSelection(
  options: {
    previewPath?: string;
    promotionPath?: string;
    driveMaterializationsPath?: string;
    webEvidencePath?: string;
    selectionPath?: string;
    jobsPath?: string;
    reportPath?: string;
  } = {}
) {
  const previewPath = options.previewPath ?? DEFAULT_PREVIEW_PATH;
  const promotionPath = options.promotionPath ?? DEFAULT_PROMOTION_PATH;
  const driveMaterializationsPath =
    options.driveMaterializationsPath ?? DEFAULT_DRIVE_MATERIALIZATIONS_PATH;
  const webEvidencePath = options.webEvidencePath ?? DEFAULT_WEB_EVIDENCE_PATH;
  const selectionPath = options.selectionPath ?? DEFAULT_SELECTION_PATH;
  const jobsPath = options.jobsPath ?? DEFAULT_JOBS_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const [preview, promotion, driveMaterializations, webEvidence] = await Promise.all([
    readRequiredJson<ExistingSarimaImageEnrichmentPreview>(
      previewPath,
      "CATALOG_IMAGE_SOURCE_SELECTION_PREVIEW_READ_FAILED"
    ),
    readRequiredJson<PromotionArtifact>(
      promotionPath,
      "CATALOG_IMAGE_SOURCE_SELECTION_PROMOTION_READ_FAILED"
    ),
    readOptionalArray<CatalogDriveImageMaterialization>(
      driveMaterializationsPath,
      "CATALOG_IMAGE_SOURCE_SELECTION_DRIVE_MATERIALIZATIONS_READ_FAILED"
    ),
    readOptionalArray<CatalogLicensedWebImageEvidence>(
      webEvidencePath,
      "CATALOG_IMAGE_SOURCE_SELECTION_WEB_EVIDENCE_READ_FAILED"
    )
  ]);

  const artifacts = buildCatalogImageSourceArtifacts({
    preview,
    promotion,
    driveMaterializations,
    webEvidence
  });

  await Promise.all([
    writeText(selectionPath, `${JSON.stringify(artifacts.selection, null, 2)}\n`),
    writeText(jobsPath, `${JSON.stringify(artifacts.jobs, null, 2)}\n`),
    writeText(reportPath, `${toMarkdown(artifacts)}\n`)
  ]);

  return artifacts;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return (
    Boolean(entryPoint) &&
    path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url))
  );
}

if (isDirectExecution()) {
  const artifacts = await generateCatalogImageSourceSelection();
  console.log(
    JSON.stringify(
      {
        summary: artifacts.selection.summary,
        ciqeJobs: artifacts.jobs.length,
        selectionPath: DEFAULT_SELECTION_PATH,
        jobsPath: DEFAULT_JOBS_PATH,
        reportPath: DEFAULT_REPORT_PATH
      },
      null,
      2
    )
  );
}
