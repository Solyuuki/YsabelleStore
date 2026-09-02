import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateCatalogImageReconciliation } from "../src/scripts/reconcileCatalogImages.js";
import { buildDriveImageManifest } from "../src/modules/catalog/drive-image-manifest.js";
import { normalizeSarimaSourceName, type SarimaSourceIdentity } from "../src/modules/catalog/sarima-source-manifest.js";

function source(productCode: string, sourceName: string): SarimaSourceIdentity {
  return {
    category: "Test",
    productCode,
    sourceName,
    sourceNameNormalized: normalizeSarimaSourceName(sourceName),
    yearsPresent: [2024, 2025]
  };
}

test("generates deterministic JSON, CSV, and markdown reconciliation artifacts from manifest files", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "phase9-reconciliation-"));
  const sarimaPath = path.join(dir, "sarima.json");
  const drivePath = path.join(dir, "drive.json");
  const jsonPath = path.join(dir, "reconciliation.json");
  const csvPath = path.join(dir, "reconciliation.csv");
  const reportPath = path.join(dir, "report.md");

  const sources = [source("P001", "Exact Product"), source("P002", "Missing Product")];
  const drive = buildDriveImageManifest([
    {
      fileId: "exact-1",
      filename: "Exact Product.jpg",
      folderId: "folder-1",
      folderName: "Test",
      mimeType: "image/jpeg"
    },
    {
      fileId: "drive-only-1",
      filename: "Unrelated Asset.jpg",
      folderId: "folder-1",
      folderName: "Test",
      mimeType: "image/jpeg"
    }
  ]);

  await fs.writeFile(sarimaPath, JSON.stringify(sources), "utf8");
  await fs.writeFile(drivePath, JSON.stringify(drive), "utf8");

  const output = await generateCatalogImageReconciliation({
    sarimaManifestPath: sarimaPath,
    driveManifestPath: drivePath,
    jsonPath,
    csvPath,
    reportPath
  });

  assert.deepEqual(output.report.statusCounts, {
    EXACT_MATCH: 1,
    NEEDS_REVIEW: 0,
    VARIANT_SIZE_MISMATCH: 0,
    DUPLICATE_IMAGE: 0,
    MISSING_IMAGE: 1,
    DRIVE_ONLY: 1
  });

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const csv = await fs.readFile(csvPath, "utf8");
  const markdown = await fs.readFile(reportPath, "utf8");

  assert.equal(json.sourceCount, 2);
  assert.equal(json.driveAssetCount, 2);
  assert.equal(json.reconciliation.sourceOutcomes.length, 2);
  assert.match(csv, /P002,Missing Product,MISSING_IMAGE/);
  assert.match(markdown, /\| DRIVE_ONLY \| 1 \|/);
});
