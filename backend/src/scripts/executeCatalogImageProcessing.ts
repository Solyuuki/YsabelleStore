import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildCatalogDriveMaterializationPlan,
  materializeCatalogDriveImages,
  type CatalogDriveDownloader
} from "../modules/catalog/catalog-image-drive-materialization.js";
import {
  buildCatalogImageEngineJobs,
  buildCatalogImageSourceSelection,
  type CatalogImageEngineJob,
  type CatalogLicensedWebImageEvidence
} from "../modules/catalog/catalog-image-source-selection.js";
import type { ExistingSarimaImageEnrichmentPreview } from "../modules/catalog/catalog-existing-sarima-image-enrichment-preview.js";
import type { ExistingSarimaPromotionEvidence } from "../modules/catalog/catalog-existing-sarima-rehabilitation-readiness.js";
import type { DriveImageAsset } from "../modules/catalog/drive-image-manifest.js";

export type CatalogImageCiqeSummary = {
  counts: {
    APPROVED: number;
    REJECTED: number;
    PROCESS_ERROR: number;
  };
  results: Array<{
    productCode: string;
    fileId: string;
    status: string;
    [key: string]: unknown;
  }>;
};

export type CatalogImageCiqeRunner = (input: {
  jobs: CatalogImageEngineJob[];
  repositoryRoot: string;
  jobsPath: string;
  outputRoot: string;
  summaryPath: string;
}) => Promise<CatalogImageCiqeSummary>;

type PromotionArtifact = { rows: ExistingSarimaPromotionEvidence[] };

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

async function readOptionalArray<T>(filePath: string): Promise<T[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) throw new Error("expected JSON array");
    return parsed as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runProcess(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

export const defaultCatalogImageCiqeRunner: CatalogImageCiqeRunner = async ({
  jobs,
  repositoryRoot,
  jobsPath,
  outputRoot,
  summaryPath
}) => {
  if (jobs.length === 0) {
    const empty: CatalogImageCiqeSummary = {
      counts: { APPROVED: 0, REJECTED: 0, PROCESS_ERROR: 0 },
      results: []
    };
    await writeJson(summaryPath, empty);
    return empty;
  }

  const pythonCommand = process.env.PYTHON_COMMAND?.trim() || "python";
  const batchScript = path.join(repositoryRoot, "catalog-image-engine", "app", "batch.py");
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });

  await runProcess(
    pythonCommand,
    [batchScript, jobsPath, outputRoot, summaryPath],
    repositoryRoot
  );

  return readJson<CatalogImageCiqeSummary>(summaryPath);
};

export async function executeCatalogImageProcessing(options: {
  repositoryRoot?: string;
  download?: CatalogDriveDownloader;
  runCiqe?: CatalogImageCiqeRunner;
} = {}) {
  const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
  const previewPath = path.join(
    repositoryRoot,
    "reports/catalog-quality/phase9-existing-sarima-image-enrichment-preview.json"
  );
  const artifactsRoot = path.join(repositoryRoot, "artifacts/catalog/phase9");
  const driveManifestPath = path.join(artifactsRoot, "drive-image-manifest.json");
  const promotionPath = path.join(artifactsRoot, "catalog-promotion-preview.json");
  const webEvidencePath = path.join(artifactsRoot, "image-source-web-evidence.json");
  const materializationsPath = path.join(
    artifactsRoot,
    "image-source-drive-materializations.json"
  );
  const jobsPath = path.join(artifactsRoot, "image-engine-jobs.json");
  const selectionPath = path.join(
    repositoryRoot,
    "reports/catalog-quality/phase9-image-source-selection.json"
  );
  const ciqeSummaryPath = path.join(
    repositoryRoot,
    "reports/catalog-quality/phase9-image-engine-summary.json"
  );
  const ciqeOutputRoot = path.join(repositoryRoot, ".data/catalog-image-engine-output");

  const [preview, driveAssets, promotion, webEvidence] = await Promise.all([
    readJson<ExistingSarimaImageEnrichmentPreview>(previewPath),
    readJson<DriveImageAsset[]>(driveManifestPath),
    readJson<PromotionArtifact>(promotionPath),
    readOptionalArray<CatalogLicensedWebImageEvidence>(webEvidencePath)
  ]);

  if (!Array.isArray(preview.rows)) {
    throw new Error("CATALOG_IMAGE_PROCESSING_INVALID_PREVIEW: preview.rows must be an array");
  }
  if (!Array.isArray(driveAssets)) {
    throw new Error("CATALOG_IMAGE_PROCESSING_INVALID_DRIVE_MANIFEST: expected an array");
  }
  if (!promotion || !Array.isArray(promotion.rows)) {
    throw new Error("CATALOG_IMAGE_PROCESSING_INVALID_PROMOTION: promotion.rows must be an array");
  }

  const plan = buildCatalogDriveMaterializationPlan({ rows: preview.rows, driveAssets });
  const materializations = await materializeCatalogDriveImages({
    plan,
    repositoryRoot,
    download: options.download
  });
  await writeJson(materializationsPath, materializations);

  const selection = buildCatalogImageSourceSelection({
    rows: preview.rows,
    promotionRows: promotion.rows,
    driveMaterializations: materializations,
    webEvidence
  });
  const jobs = buildCatalogImageEngineJobs(selection);
  await Promise.all([writeJson(selectionPath, selection), writeJson(jobsPath, jobs)]);

  const ciqe = await (options.runCiqe ?? defaultCatalogImageCiqeRunner)({
    jobs,
    repositoryRoot,
    jobsPath,
    outputRoot: ciqeOutputRoot,
    summaryPath: ciqeSummaryPath
  });

  return {
    materialization: {
      total: materializations.length,
      usable: materializations.filter((row) => row.usable).length,
      failed: materializations.filter((row) => !row.usable).length
    },
    selection: selection.summary,
    ciqeJobs: jobs.length,
    ciqeCounts: ciqe.counts,
    materializationsPath,
    selectionPath,
    jobsPath,
    ciqeSummaryPath,
    ciqeOutputRoot
  };
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const result = await executeCatalogImageProcessing();
  console.log(JSON.stringify(result, null, 2));
}
