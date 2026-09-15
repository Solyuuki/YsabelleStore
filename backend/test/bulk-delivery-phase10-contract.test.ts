import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { normalizePdfDeliveryExpiryForReceiving } from "../src/services/bulkDeliveryService.js";
import { extractDeliveryRowsFromTextItems } from "../src/services/pdfDeliveryImportService.js";
import { completeBulkDeliverySchema } from "../src/validators/bulkDelivery.validators.js";

const serviceSource = readFileSync(
  resolve(process.cwd(), "src/services/bulkDeliveryService.ts"),
  "utf8"
);
const routeSource = readFileSync(resolve(process.cwd(), "src/routes/inventory.routes.ts"), "utf8");

test("Phase 10 standalone bulk delivery accepts explicit no-expiry rows", () => {
  const result = completeBulkDeliverySchema.safeParse({
    sourceType: "PDF",
    sourceFileName: "supplier-delivery.pdf",
    rows: [
      {
        productId: "product-1",
        receivedQuantity: 12,
        damagedQuantity: 0,
        batchCode: "LOT-A001",
        expiresAt: null,
        noExpiration: true,
        reason: "Supplier PDF receipt"
      }
    ]
  });

  assert.equal(result.success, true);
});

test("Phase 10 bulk delivery requires expiry or explicit no-expiry for accepted stock", () => {
  const result = completeBulkDeliverySchema.safeParse({
    sourceType: "PDF",
    rows: [
      {
        productId: "product-1",
        receivedQuantity: 12,
        damagedQuantity: 0,
        batchCode: "LOT-A001",
        expiresAt: null,
        noExpiration: false
      }
    ]
  });

  assert.equal(result.success, false);
});

test("Phase 10 linked Restock delivery supports partial and damaged lines", () => {
  const result = completeBulkDeliverySchema.safeParse({
    sourceType: "SPREADSHEET",
    sourceFileName: "delivery.xlsx",
    restockOrderId: "restock-1",
    expectedOrderVersion: 4,
    rows: [
      {
        productId: "product-1",
        restockOrderLineId: "line-1",
        receivedQuantity: 8,
        damagedQuantity: 2,
        damageReason: "Dented cans",
        acceptedQuantity: 6,
        batchCode: "LOT-A001",
        expiresAt: "2027-09-13",
        noExpiration: false
      },
      {
        productId: "product-2",
        restockOrderLineId: "line-2",
        receivedQuantity: 0,
        damagedQuantity: 0,
        acceptedQuantity: 0,
        batchCode: null,
        expiresAt: null,
        noExpiration: false
      }
    ]
  });

  assert.equal(result.success, true);
});

test("Phase 10 standalone damage is blocked so returns stay tied to Restock Orders", () => {
  const result = completeBulkDeliverySchema.safeParse({
    sourceType: "PDF",
    rows: [
      {
        productId: "product-1",
        receivedQuantity: 12,
        damagedQuantity: 2,
        damageReason: "Damaged packaging",
        acceptedQuantity: 10,
        batchCode: "LOT-A001",
        expiresAt: null,
        noExpiration: true
      }
    ]
  });

  assert.equal(result.success, false);
});

test("Phase 10 linked delivery delegates to certified Restock receiving authority", () => {
  assert.match(serviceSource, /receiveRestockOrder/);
  assert.match(serviceSource, /restockOrderId/);
  assert.match(serviceSource, /expectedOrderVersion/);
  assert.match(serviceSource, /damagedQuantity/);
  assert.match(serviceSource, /requiresReturnReport/);
});

test("Phase 10 standalone bulk delivery remains an atomic canonical receiving operation", () => {
  assert.match(serviceSource, /prisma\.\$transaction/);
  assert.match(serviceSource, /receiveStockInTransaction/);
  assert.match(serviceSource, /referenceType: "BULK_DELIVERY"/);
  assert.doesNotMatch(serviceSource, /inventory\.update\s*\(/);
  assert.doesNotMatch(serviceSource, /inventoryBatch\.(?:create|update)\s*\(/);
});

test("Phase 10 PDF expiry reaches receiving with spreadsheet-compatible date semantics", () => {
  const pdfExpiry = new Date("2029-03-31T00:00:00Z");
  const normalizedPdfExpiry = normalizePdfDeliveryExpiryForReceiving(pdfExpiry);
  const spreadsheetExpiry = new Date("2029-03-31T00:00:00");

  assert.ok(normalizedPdfExpiry);
  assert.equal(normalizedPdfExpiry.getTime(), spreadsheetExpiry.getTime());
  assert.match(serviceSource, /const normalizedInput = normalizePdfDeliveryExpiries\(input\)/);
});

test("Phase 10 bulk delivery endpoint stays Owner controlled", () => {
  assert.match(routeSource, /"\/delivery-sessions\/complete"/);
  assert.match(
    routeSource,
    /"\/delivery-sessions\/complete"[\s\S]*?requireRole\("OWNER"\)[\s\S]*?completeBulkDeliveryController/
  );
});

test("Phase 10 PDF delivery parser extracts structured supplier rows without manual rebuilding", () => {
  const rows = extractDeliveryRowsFromTextItems([
    { page: 1, x: 10, y: 100, text: "Product" },
    { page: 1, x: 90, y: 100, text: "SKU" },
    { page: 1, x: 140, y: 100, text: "Barcode" },
    { page: 1, x: 210, y: 100, text: "Qty" },
    { page: 1, x: 250, y: 100, text: "Batch / Lot" },
    { page: 1, x: 330, y: 100, text: "Expiry" },
    { page: 1, x: 10, y: 80, text: "555 Tuna Mechado" },
    { page: 1, x: 90, y: 80, text: "SARIMA-P010" },
    { page: 1, x: 140, y: 80, text: "748485700045" },
    { page: 1, x: 210, y: 80, text: "5" },
    { page: 1, x: 250, y: 80, text: "BULKQA-MECHADO-001" },
    { page: 1, x: 330, y: 80, text: "2029-03-31" }
  ]);

  assert.deepEqual(rows, [
    {
      productName: "555 Tuna Mechado",
      sku: "SARIMA-P010",
      barcode: "748485700045",
      quantity: "5",
      batchCode: "BULKQA-MECHADO-001",
      expirationDate: "2029-03-31"
    }
  ]);
});

test("Phase 10 PDF preview endpoint is Owner controlled", () => {
  assert.match(routeSource, /"\/delivery-sessions\/pdf\/preview"/);
  assert.match(
    routeSource,
    /"\/delivery-sessions\/pdf\/preview"[\s\S]*?requireRole\("OWNER"\)[\s\S]*?previewBulkDeliveryPdfController/
  );
});
