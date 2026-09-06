import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  reconcileCatalogImages,
  type CatalogImageReconciliation
} from "../modules/catalog/catalog-image-reconciliation.js";
import {
  buildImageReconciliationReport,
  toImageReconciliationCsv,
  toImageReconciliationMarkdown,
  type ImageReconciliationReport
} from "../modules/catalog/catalog-image-reconciliation-report.js";
import type { DriveImageAsset } from "../modules/catalog/drive-image-manifest.js";
import type { SarimaSourceIdentity } from "../modules/catalog/sarima-source-manifest.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_SARIMA_MANIFEST_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/sarima-source-manifest.json"
);
const DEFAULT_DRIVE_MANIFEST_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/drive-image-manifest.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/image-reconciliation.json"
);
const DEFAULT_CSV_PATH = resolveRepositoryPath("artifacts/catalog/phase9/image-reconciliation.csv");
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-image-reconciliation-report.md"
);

export type CatalogImageReconciliationOutput = {
  report: ImageReconciliationReport;
  reconciliation: CatalogImageReconciliation;
};

export type GenerateCatalogImageReconciliationOptions = {
  sarimaManifestPath?: string;
  driveManifestPath?: string;
  jsonPath?: string;
  csvPath?: string;
  reportPath?: string;
};

async function readJsonArray<T>(filePath: string, label: string): Promise<T[]> {
  const raw = await fs.readFile(filePath, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${label} manifest: ${filePath}.`, { cause: error });
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${label} manifest must contain a JSON array: ${filePath}.`);
  }

  return parsed as T[];
}

async function writeTextFile(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateCatalogImageReconciliation(
  options: GenerateCatalogImageReconciliationOptions = {}
): Promise<CatalogImageReconciliationOutput> {
  const sarimaManifestPath = options.sarimaManifestPath ?? DEFAULT_SARIMA_MANIFEST_PATH;
  const driveManifestPath = options.driveManifestPath ?? DEFAULT_DRIVE_MANIFEST_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const csvPath = options.csvPath ?? DEFAULT_CSV_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const sources = await readJsonArray<SarimaSourceIdentity>(sarimaManifestPath, "SARIMA source");
  const images = await readJsonArray<DriveImageAsset>(driveManifestPath, "Drive image");

  const reconciliation = reconcileCatalogImages(sources, images);
  const report = buildImageReconciliationReport(reconciliation, sources.length, images.length);
  const output: CatalogImageReconciliationOutput = { report, reconciliation };
  const jsonArtifact = {
    sourceCount: report.sourceCount,
    driveAssetCount: report.driveAssetCount,
    statusCounts: report.statusCounts,
    missingProductCodes: report.missingProductCodes,
    reconciliation
  };

  await Promise.all([
    writeTextFile(jsonPath, `${JSON.stringify(jsonArtifact, null, 2)}\n`),
    writeTextFile(csvPath, toImageReconciliationCsv(reconciliation)),
    writeTextFile(reportPath, `${toImageReconciliationMarkdown(report, reconciliation)}\n`)
  ]);

  return output;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  if (!entryPoint) return false;

  return path.resolve(entryPoint) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const output = await generateCatalogImageReconciliation();

  console.log(
    JSON.stringify(
      {
        sourceCount: output.report.sourceCount,
        driveAssetCount: output.report.driveAssetCount,
        statusCounts: output.report.statusCounts,
        missingProductCodes: output.report.missingProductCodes
      },
      null,
      2
    )
  );
}
