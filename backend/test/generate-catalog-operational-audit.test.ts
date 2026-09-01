import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generateOperationalCatalogAudit,
  type OperationalAuditPrismaClient
} from "../src/scripts/generateOperationalCatalogAudit.js";
import type { CatalogPromotionPreview } from "../src/modules/catalog/catalog-promotion-preview.js";

const preview: CatalogPromotionPreview = {
  sourceIdentityCount: 2,
  canonicalIdentityCount: 2,
  duplicateAliasCount: 0,
  blockedIdentityCount: 0,
  rows: [
    {
      productCode: "P001",
      sourceName: "Mapped Product",
      category: "Beverages",
      identityStatus: "CANONICAL",
      canonicalProductCode: "P001",
      imageStatus: "EXACT_MATCH",
      assetFileIds: ["img-1"],
      identityReason: "canonical",
      imageReason: "exact",
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      operationalAction: "REQUIRES_DATABASE_AUDIT"
    },
    {
      productCode: "P002",
      sourceName: "New Product",
      category: "Snacks",
      identityStatus: "CANONICAL",
      canonicalProductCode: "P002",
      imageStatus: "MISSING_IMAGE",
      assetFileIds: [],
      identityReason: "canonical",
      imageReason: "missing",
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      operationalAction: "REQUIRES_DATABASE_AUDIT"
    }
  ]
};

test("operational audit generator reads catalog state and writes a dry-run report without database mutations", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "operational-catalog-audit-"));
  const previewPath = path.join(temp, "preview.json");
  const jsonPath = path.join(temp, "audit.json");
  const reportPath = path.join(temp, "audit.md");
  await fs.writeFile(previewPath, JSON.stringify(preview), "utf8");

  let findManyCalls = 0;
  const client: OperationalAuditPrismaClient = {
    product: {
      async findMany() {
        findManyCalls += 1;
        return [
          {
            id: "db-real",
            sku: "REAL-001",
            barcode: "4800000000001",
            name: "Mapped Product",
            recordSource: "CATALOG",
            dataQualityStatus: "APPROVED",
            sarimaSourceMapping: { sourceProductId: "P001" },
            aliases: [{ value: "Old Mapped Product" }],
            inventory: { id: "inventory-1" },
            _count: {
              inventoryBatches: 1,
              inventoryMovements: 2,
              saleItems: 3,
              forecastRecords: 0,
              recommendationRecords: 0,
              historicalMonthlySales: 24,
              historicalSalesImportRows: 24,
              customerOrderItems: 0,
              reviews: 0,
              imageAssets: 1
            }
          },
          {
            id: "db-fixture",
            sku: "POSPAQ-Q-101",
            barcode: null,
            name: "Test item 101",
            recordSource: "TEST_FIXTURE",
            dataQualityStatus: "REJECTED",
            sarimaSourceMapping: null,
            aliases: [],
            inventory: null,
            _count: {
              inventoryBatches: 0,
              inventoryMovements: 0,
              saleItems: 1,
              forecastRecords: 0,
              recommendationRecords: 0,
              historicalMonthlySales: 0,
              historicalSalesImportRows: 0,
              customerOrderItems: 0,
              reviews: 0,
              imageAssets: 0
            }
          }
        ];
      }
    }
  };

  const audit = await generateOperationalCatalogAudit({
    client,
    previewPath,
    jsonPath,
    reportPath
  });

  assert.equal(findManyCalls, 1);
  assert.equal(audit.summary.existing, 1);
  assert.equal(audit.summary.new, 1);
  assert.equal(audit.summary.testFixtures, 1);
  assert.equal(audit.summary.testFixturesWithProtectedReferences, 1);

  const artifact = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(artifact.summary.existing, 1);
  const report = await fs.readFile(reportPath, "utf8");
  assert.match(report, /read-only/i);
  assert.match(report, /No Product, Inventory, InventoryBatch, price, stock, mapping, or fixture data was modified/i);
});
