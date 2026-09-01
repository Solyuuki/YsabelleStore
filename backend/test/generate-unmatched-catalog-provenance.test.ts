import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generateUnmatchedCatalogProvenance,
  type UnmatchedCatalogProvenancePrismaClient
} from "../src/scripts/generateUnmatchedCatalogProvenance.js";

test("unmatched catalog provenance generator reads only unresolved products and writes evidence without mutations", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-unmatched-provenance-"));
  const auditPath = path.join(temp, "operational-audit.json");
  const jsonPath = path.join(temp, "provenance.json");
  const reportPath = path.join(temp, "provenance.md");

  await fs.writeFile(
    auditPath,
    JSON.stringify({
      unmatchedOperationalProducts: [
        { productId: "product-a" },
        { productId: "product-b" }
      ]
    }),
    "utf8"
  );

  let findManyCalls = 0;
  let capturedArgs: any;
  const client: UnmatchedCatalogProvenancePrismaClient = {
    product: {
      async findMany(args) {
        findManyCalls += 1;
        capturedArgs = args;
        return [
          {
            id: "product-a",
            sku: "PAN-UBE-001",
            barcode: "4800041123456",
            name: "Ube Condensed Milk",
            description: "QA provenance candidate",
            brand: null,
            variant: null,
            status: "ACTIVE",
            recordSource: "CATALOG",
            dataQualityStatus: "NEEDS_REVIEW",
            costPrice: "70.00",
            sellingPrice: "89.50",
            createdAt: new Date("2026-08-01T10:00:00.000Z"),
            updatedAt: new Date("2026-08-02T10:00:00.000Z"),
            category: { id: "cat-1", name: "Staples", slug: "staples" },
            inventory: {
              quantityOnHand: 7,
              lastStockUpdatedAt: new Date("2026-08-01T11:00:00.000Z"),
              createdAt: new Date("2026-08-01T10:05:00.000Z"),
              updatedAt: new Date("2026-08-01T11:00:00.000Z")
            },
            inventoryBatches: [
              {
                id: "batch-a",
                batchCode: "BATCH-A",
                quantityReceived: 10,
                quantityRemaining: 7,
                unitCost: "70.00",
                receivedAt: new Date("2026-08-01T10:10:00.000Z"),
                expiresAt: null,
                status: "AVAILABLE",
                createdAt: new Date("2026-08-01T10:10:00.000Z")
              }
            ],
            inventoryMovements: [
              {
                id: "movement-a",
                type: "SALE",
                quantity: 1,
                quantityBefore: 10,
                quantityAfter: 9,
                reason: "POS validation",
                referenceType: "SALE",
                referenceId: "sale-a",
                createdAt: new Date("2026-08-01T12:00:00.000Z")
              }
            ],
            saleItems: [
              {
                id: "sale-item-a",
                quantity: 1,
                unitPrice: "89.50",
                totalAmount: "89.50",
                createdAt: new Date("2026-08-01T12:00:00.000Z"),
                sale: {
                  id: "sale-a",
                  saleNumber: "SALE-TEST-001",
                  saleDate: new Date("2026-08-01T12:00:00.000Z"),
                  status: "COMPLETED",
                  notes: "QA checkout",
                  createdAt: new Date("2026-08-01T12:00:00.000Z")
                }
              }
            ]
          }
        ];
      }
    }
  };

  const result = await generateUnmatchedCatalogProvenance({
    client,
    auditPath,
    jsonPath,
    reportPath
  });

  assert.equal(findManyCalls, 1);
  assert.deepEqual(capturedArgs.where.id.in, ["product-a", "product-b"]);
  assert.equal(result.requestedProductCount, 2);
  assert.equal(result.resolvedProductCount, 1);
  assert.equal(result.missingProductCount, 1);

  const product = result.products[0];
  assert.equal(product?.productId, "product-a");
  assert.equal(product?.sellingPrice, "89.50");
  assert.equal(product?.inventory?.quantityOnHand, 7);
  assert.equal(product?.inventoryBatches[0]?.batchCode, "BATCH-A");
  assert.equal(product?.inventoryMovements[0]?.reason, "POS validation");
  assert.equal(product?.saleItems[0]?.sale.saleNumber, "SALE-TEST-001");
  assert.equal(product?.saleItems[0]?.sale.notes, "QA checkout");

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.products[0].barcode, "4800041123456");
  const report = await fs.readFile(reportPath, "utf8");
  assert.match(report, /READ-ONLY/i);
  assert.match(report, /SALE-TEST-001/);
  assert.match(report, /QA checkout/);
});
