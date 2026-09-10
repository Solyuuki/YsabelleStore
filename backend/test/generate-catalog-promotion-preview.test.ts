import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateCatalogPromotionPreview } from "../src/scripts/generateCatalogPromotionPreview.js";

test("catalog promotion preview script writes a dry-run artifact without database writes", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-promotion-preview-"));
  const sarimaManifestPath = path.join(temp, "sarima.json");
  const reconciliationPath = path.join(temp, "reconciliation.json");
  const jsonPath = path.join(temp, "preview.json");
  const reportPath = path.join(temp, "preview.md");

  await fs.writeFile(
    sarimaManifestPath,
    JSON.stringify([
      {
        category: "Beverages",
        productCode: "P001",
        sourceName: "Exact Product",
        sourceNameNormalized: "exact product",
        yearsPresent: [2024, 2025]
      },
      {
        category: "Beverages",
        productCode: "P002",
        sourceName: "Alias Product",
        sourceNameNormalized: "alias product",
        yearsPresent: [2024, 2025]
      }
    ])
  );
  await fs.writeFile(
    reconciliationPath,
    JSON.stringify({
      sourceCount: 2,
      driveAssetCount: 1,
      reconciliation: {
        sourceOutcomes: [
          {
            productCode: "P001",
            sourceName: "Exact Product",
            sourceNameNormalized: "exact product",
            status: "EXACT_MATCH",
            assetFileIds: ["img-1"],
            reason: "Normalized source and Drive identities match exactly."
          },
          {
            productCode: "P002",
            sourceName: "Alias Product",
            sourceNameNormalized: "alias product",
            status: "NEEDS_REVIEW",
            assetFileIds: [],
            reason:
              "Token-equivalent historical source identity overlaps P001; review source identity before assigning another Drive image."
          }
        ],
        driveOnlyAssets: []
      }
    })
  );

  const preview = await generateCatalogPromotionPreview({
    sarimaManifestPath,
    reconciliationPath,
    jsonPath,
    reportPath
  });

  assert.equal(preview.sourceIdentityCount, 2);
  assert.equal(preview.canonicalIdentityCount, 1);
  assert.equal(preview.duplicateAliasCount, 1);
  assert.equal(preview.blockedIdentityCount, 0);

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.canonicalIdentityCount, 1);
  assert.match(
    await fs.readFile(reportPath, "utf8"),
    /No Product, Inventory, InventoryBatch, price, or stock data was modified/i
  );
});
