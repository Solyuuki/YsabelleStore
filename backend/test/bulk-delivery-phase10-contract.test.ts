import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { completeBulkDeliverySchema } from "../src/validators/bulkDelivery.validators.js";

const serviceSource = readFileSync(
  resolve(process.cwd(), "src/services/bulkDeliveryService.ts"),
  "utf8"
);
const routeSource = readFileSync(resolve(process.cwd(), "src/routes/inventory.routes.ts"), "utf8");

test("Phase 10 bulk delivery validator accepts explicit no-expiry rows", () => {
  const result = completeBulkDeliverySchema.safeParse({
    sourceType: "PDF",
    sourceFileName: "supplier-delivery.pdf",
    rows: [
      {
        productId: "product-1",
        receivedQuantity: 12,
        batchCode: "LOT-A001",
        expiresAt: null,
        noExpiration: true,
        reason: "Supplier PDF receipt"
      }
    ]
  });

  assert.equal(result.success, true);
});

test("Phase 10 bulk delivery validator requires expiry or explicit no-expiry", () => {
  const result = completeBulkDeliverySchema.safeParse({
    sourceType: "PDF",
    rows: [
      {
        productId: "product-1",
        receivedQuantity: 12,
        batchCode: "LOT-A001",
        expiresAt: null,
        noExpiration: false
      }
    ]
  });

  assert.equal(result.success, false);
});

test("Phase 10 bulk delivery remains an atomic canonical receiving operation", () => {
  assert.match(serviceSource, /prisma\.\$transaction/);
  assert.match(serviceSource, /receiveStockInTransaction/);
  assert.match(serviceSource, /referenceType: "BULK_DELIVERY"/);
  assert.doesNotMatch(serviceSource, /inventory\.update\s*\(/);
  assert.doesNotMatch(serviceSource, /inventoryBatch\.(?:create|update)\s*\(/);
});

test("Phase 10 bulk delivery endpoint stays Owner controlled", () => {
  assert.match(routeSource, /"\/delivery-sessions\/complete"/);
  assert.match(
    routeSource,
    /"\/delivery-sessions\/complete"[\s\S]*?requireRole\("OWNER"\)[\s\S]*?completeBulkDeliveryController/
  );
});
