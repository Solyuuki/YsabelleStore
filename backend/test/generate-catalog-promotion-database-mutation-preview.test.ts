import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generateCatalogPromotionDatabaseMutationPreview,
  type CatalogPromotionDatabaseMutationPreviewPrismaClient
} from "../src/scripts/generateCatalogPromotionDatabaseMutationPreview.js";

const stagingRow = {
  productCode: "P001",
  plannedSku: "SARIMA-P001",
  plannedName: "Sample Shampoo Sachet 13mL",
  plannedCategory: "Personal Care",
  plannedSellingPrice: 8.5,
  sellingPriceProvenance: "LAST_RECORDED_HISTORICAL_PRICE_2025",
  sellingPriceUsage: "PROVISIONAL_INACTIVE_ONLY",
  currentSellingPrice: null,
  currentPriceReadiness: "UNVERIFIED",
  plannedUnit: "SACHET",
  unitEvidence: "EXPLICIT_SACHET",
  plannedStatus: "INACTIVE",
  plannedDataQualityStatus: "NEEDS_REVIEW",
  plannedRecordSource: "IMPORT",
  plannedStorefrontVisible: false,
  plannedCreateInventory: false,
  plannedCreateInventoryBatch: false,
  plannedCreateSarimaMapping: true,
  imageStatus: "EXACT_MATCH",
  assetFileIds: ["drive-1"],
  activationBlockers: ["CURRENT_SELLING_PRICE", "PHYSICAL_STOCK", "QUALITY_APPROVAL"]
};

test("database mutation preview generator performs constrained reads only and writes a non-mutating review artifact", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-db-mutation-preview-"));
  const stagingPath = path.join(temp, "staging.json");
  const jsonPath = path.join(temp, "preview.json");
  const reportPath = path.join(temp, "preview.md");

  await fs.writeFile(stagingPath, JSON.stringify({ stageableRows: [stagingRow] }), "utf8");

  const calls: Array<{ model: string; args: unknown }> = [];
  const client: CatalogPromotionDatabaseMutationPreviewPrismaClient = {
    category: {
      async findMany(args) {
        calls.push({ model: "category", args });
        return [
          {
            id: "cat_personal_care",
            name: "Personal Care",
            slug: "personal-care",
            isActive: true,
            recordSource: "INTERNAL",
            dataQualityStatus: "APPROVED"
          }
        ];
      }
    },
    product: {
      async findMany(args) {
        calls.push({ model: "product", args });
        return [];
      }
    },
    sarimaSourceProductMapping: {
      async findMany(args) {
        calls.push({ model: "mapping", args });
        return [];
      }
    }
  };

  const result = await generateCatalogPromotionDatabaseMutationPreview({
    client,
    stagingPath,
    jsonPath,
    reportPath
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.model), ["category", "product", "mapping"]);
  assert.deepEqual((calls[0]!.args as any).where, {
    OR: [
      { name: { in: ["Personal Care"] } },
      { slug: { in: ["personal-care"] } }
    ]
  });
  assert.deepEqual((calls[0]!.args as any).select, {
    id: true,
    name: true,
    slug: true,
    isActive: true,
    recordSource: true,
    dataQualityStatus: true
  });
  assert.deepEqual((calls[1]!.args as any).where.sku.in, ["SARIMA-P001"]);
  assert.deepEqual((calls[2]!.args as any).where.sourceProductId.in, ["P001"]);

  assert.equal(result.summary.productCreateReady, 1);
  assert.equal(result.summary.plannedInventoryRows, 0);
  assert.equal(result.summary.plannedInventoryBatchRows, 0);
  assert.equal(result.rows[0]?.plannedProductCreate?.costPrice, null);
  assert.equal(result.rows[0]?.plannedSarimaMappingCreate, null);

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.rows[0].plannedStatus, undefined);
  assert.equal(json.rows[0].plannedProductCreate.status, "INACTIVE");

  const report = await fs.readFile(reportPath, "utf8");
  assert.match(report, /READ-ONLY/i);
  assert.match(report, /does not execute/i);
  assert.match(report, /costPrice.*null/i);
  assert.match(report, /mapping metadata/i);
});

test("database mutation preview generator fetches canonical slug candidates so P040 can resolve without a write", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-db-mutation-p040-"));
  const stagingPath = path.join(temp, "staging.json");
  const jsonPath = path.join(temp, "preview.json");
  const reportPath = path.join(temp, "preview.md");
  const p040 = {
    ...stagingRow,
    productCode: "P040",
    plannedSku: "SARIMA-P040",
    plannedCategory: "Frozen / Chilled"
  };

  await fs.writeFile(stagingPath, JSON.stringify({ stageableRows: [p040] }), "utf8");

  let categoryArgs: unknown;
  const client: CatalogPromotionDatabaseMutationPreviewPrismaClient = {
    category: {
      async findMany(args) {
        categoryArgs = args;
        return [
          {
            id: "cat_frozen_chilled",
            name: "Frozen & Chilled",
            slug: "frozen-chilled",
            isActive: true,
            recordSource: "INTERNAL",
            dataQualityStatus: "APPROVED"
          }
        ];
      }
    },
    product: { async findMany() { return []; } },
    sarimaSourceProductMapping: { async findMany() { return []; } }
  };

  const result = await generateCatalogPromotionDatabaseMutationPreview({
    client,
    stagingPath,
    jsonPath,
    reportPath
  });

  assert.deepEqual((categoryArgs as any).where.OR[1].slug.in, ["frozen-chilled"]);
  assert.equal(result.rows[0]?.productMutationReadiness, "READY");
  assert.equal(result.rows[0]?.plannedProductCreate?.categoryId, "cat_frozen_chilled");
  assert.equal(result.summary.missingCategories, 0);
});
