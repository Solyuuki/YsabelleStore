import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertExpectedDriveImageCount,
  buildDriveImageManifest,
  type DriveImageAsset
} from "../modules/catalog/drive-image-manifest.js";
import { loadDriveImageMetadataSnapshot } from "../modules/catalog/drive-image-snapshot.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_SNAPSHOT_DIR = resolveRepositoryPath("artifacts/catalog/phase9/drive-image-metadata");
const DEFAULT_OUTPUT_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/drive-image-manifest.json"
);

export async function generateDriveImageManifest(
  snapshotDir = DEFAULT_SNAPSHOT_DIR,
  outputPath = DEFAULT_OUTPUT_PATH
): Promise<DriveImageAsset[]> {
  const metadata = await loadDriveImageMetadataSnapshot(snapshotDir);
  const manifest = buildDriveImageManifest(metadata);
  assertExpectedDriveImageCount(manifest);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifest;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];

  if (!entryPoint) return false;

  return path.resolve(entryPoint) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const snapshotDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SNAPSHOT_DIR;
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUTPUT_PATH;
  const manifest = await generateDriveImageManifest(snapshotDir, outputPath);

  console.log(
    JSON.stringify(
      {
        assets: manifest.length,
        folders: new Set(manifest.map((entry) => entry.folderId)).size,
        outputPath,
        snapshotDir
      },
      null,
      2
    )
  );
}
