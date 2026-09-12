import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  cancelRestockOrderSchema,
  receiveRestockOrderSchema
} from "../src/validators/restock.validators.js";

const restockRouteSource = readFileSync(
  new URL("../src/routes/restock.routes.ts", import.meta.url),
  "utf8"
);
const lifecycleSource = readFileSync(
  new URL("../src/services/restockLifecycleService.ts", import.meta.url),
  "utf8"
);
const receivingSource = readFileSync(
  new URL("../src/services/receivingStockService.ts", import.meta.url),
  "utf8"
);

test("Phase 8 requires a reason before cancelling a restock order", () => {
  assert.equal(
    cancelRestockOrderSchema.safeParse({ expectedVersion: 1, reason: "" }).success,
    false
  );
  assert.equal(
    cancelRestockOrderSchema.safeParse({
      expectedVersion: 1,
      reason: "Supplier can no longer fulfill this request."
    }).success,
    true
  );
});

test("Phase 9 receipt validation separates delivered, damaged and accepted quantities", () => {
  const valid = receiveRestockOrderSchema.safeParse({
    expectedVersion: 2,
    lines: [
      {
        lineId: "line-1",
        deliveredQuantity: 47,
        damagedQuantity: 2,
        acceptedQuantity: 45,
        batchCode: "BATCH-001",
        noExpiration: true
      }
    ]
  });
  const damagedTooHigh = receiveRestockOrderSchema.safeParse({
    expectedVersion: 2,
    lines: [
      {
        lineId: "line-1",
        deliveredQuantity: 5,
        damagedQuantity: 6,
        acceptedQuantity: 0
      }
    ]
  });
  const acceptedTooHigh = receiveRestockOrderSchema.safeParse({
    expectedVersion: 2,
    lines: [
      {
        lineId: "line-1",
        deliveredQuantity: 10,
        damagedQuantity: 2,
        acceptedQuantity: 9,
        batchCode: "BATCH-001",
        noExpiration: true
      }
    ]
  });

  assert.equal(valid.success, true);
  assert.equal(damagedTooHigh.success, false);
  assert.equal(acceptedTooHigh.success, false);
});

test("Accepted restock stock requires batch and explicit expiration policy", () => {
  const missingBatch = receiveRestockOrderSchema.safeParse({
    expectedVersion: 2,
    lines: [
      {
        lineId: "line-1",
        deliveredQuantity: 4,
        damagedQuantity: 0,
        acceptedQuantity: 4,
        noExpiration: true
      }
    ]
  });
  const missingExpiryPolicy = receiveRestockOrderSchema.safeParse({
    expectedVersion: 2,
    lines: [
      {
        lineId: "line-1",
        deliveredQuantity: 4,
        damagedQuantity: 0,
        acceptedQuantity: 4,
        batchCode: "BATCH-001",
        noExpiration: false
      }
    ]
  });

  assert.equal(missingBatch.success, false);
  assert.equal(missingExpiryPolicy.success, false);
});

test("Phase 8-9 routes expose staff requests and Owner-controlled lifecycle actions", () => {
  assert.match(restockRouteSource, /\/requests/);
  assert.match(restockRouteSource, /requireRole\("OWNER", "STAFF"\)/);
  assert.match(restockRouteSource, /\/:orderId\/await-delivery/);
  assert.match(restockRouteSource, /\/:orderId\/cancel/);
  assert.match(restockRouteSource, /\/:orderId\/receipts/);
  assert.match(restockRouteSource, /router\.use\(requireAuth, requireRole\("OWNER"\)\)/);
});

test("Restock Arrived reuses the canonical receiving engine and only stocks accepted units", () => {
  assert.match(lifecycleSource, /receiveStockInTransaction\s*\(/);
  assert.match(lifecycleSource, /quantity:\s*receiptLine\.acceptedQuantity/);
  assert.match(lifecycleSource, /referenceType:\s*"RESTOCK_RECEIPT"/);
  assert.match(lifecycleSource, /damaged[\s\S]*accepted/);
  assert.doesNotMatch(lifecycleSource, /inventoryBatch\.(create|upsert)\s*\(/);
  assert.doesNotMatch(lifecycleSource, /inventoryMovement\.(create|upsert)\s*\(/);
  assert.match(receivingSource, /export async function receiveStockInTransaction/);
});

test("Restock receipt claims the expected version before physical stock mutation", () => {
  const claimIndex = lifecycleSource.indexOf("const versionClaim");
  const receiveIndex = lifecycleSource.indexOf("await receiveStockInTransaction");

  assert.ok(claimIndex >= 0);
  assert.ok(receiveIndex > claimIndex);
  assert.match(lifecycleSource, /RESTOCK_RECEIPT_VERSION_CONFLICT/);
  assert.match(lifecycleSource, /confirmOverDelivery/);
});

test("Supplier-facing order notes are not polluted by receiving actor audit metadata", () => {
  const awaitingStart = lifecycleSource.indexOf(
    "export async function markRestockOrderAwaitingDelivery"
  );
  const cancelStart = lifecycleSource.indexOf("export async function cancelRestockOrder");
  const receiveStart = lifecycleSource.indexOf("export async function receiveRestockOrder");
  const awaitingBlock = lifecycleSource.slice(awaitingStart, cancelStart);
  const receivingBlock = lifecycleSource.slice(receiveStart);

  assert.doesNotMatch(awaitingBlock, /actor=/);
  assert.doesNotMatch(receivingBlock, /actor=/);
  assert.match(receivingBlock, /safeReceiptSummary/);
});
