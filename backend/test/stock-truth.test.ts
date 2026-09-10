import assert from "node:assert/strict";
import test from "node:test";

import { InventoryBatchStatus } from "@prisma/client";

import {
  calculateStockTruth,
  getDaysUntilExpiry,
  isBatchSellable
} from "../src/services/stockTruth.js";

const businessNow = new Date("2026-09-11T04:00:00.000Z");

test("stock truth excludes expired and ineligible batches without changing physical stock", () => {
  const truth = calculateStockTruth(
    [
      {
        batchCode: "VALID",
        expiresAt: new Date("2026-10-11T00:00:00.000Z"),
        quantityRemaining: 10,
        status: InventoryBatchStatus.AVAILABLE
      },
      {
        batchCode: "EXPIRED-BY-DATE",
        expiresAt: new Date("2026-09-10T00:00:00.000Z"),
        quantityRemaining: 5,
        status: InventoryBatchStatus.AVAILABLE
      },
      {
        batchCode: "EXPIRED-STATUS",
        expiresAt: new Date("2026-10-20T00:00:00.000Z"),
        quantityRemaining: 7,
        status: InventoryBatchStatus.EXPIRED
      },
      {
        batchCode: "REMOVED",
        expiresAt: new Date("2026-11-01T00:00:00.000Z"),
        quantityRemaining: 11,
        status: InventoryBatchStatus.REMOVED
      }
    ],
    businessNow
  );

  assert.equal(truth.physicalOnHand, 33);
  assert.equal(truth.sellableStock, 10);
  assert.equal(truth.expiredStock, 12);
  assert.equal(truth.sellableBatchCount, 1);
  assert.equal(truth.batchCount, 4);
});

test("available and low-stock batches remain sellable when not expired", () => {
  const availableBatch = {
    expiresAt: null,
    quantityRemaining: 4,
    status: InventoryBatchStatus.AVAILABLE
  };
  const lowStockBatch = {
    expiresAt: new Date("2026-09-12T00:00:00.000Z"),
    quantityRemaining: 2,
    status: InventoryBatchStatus.LOW_STOCK
  };

  assert.equal(isBatchSellable(availableBatch, businessNow), true);
  assert.equal(isBatchSellable(lowStockBatch, businessNow), true);
  assert.equal(
    calculateStockTruth([availableBatch, lowStockBatch], businessNow).sellableStock,
    6
  );
});

test("expiry is evaluated by Asia/Manila business date and remains sellable through expiry day", () => {
  const expiresToday = new Date("2026-09-11T00:00:00.000Z");
  const expiredYesterday = new Date("2026-09-10T00:00:00.000Z");

  assert.equal(getDaysUntilExpiry(expiresToday, businessNow), 0);
  assert.equal(getDaysUntilExpiry(expiredYesterday, businessNow), -1);
  assert.equal(
    isBatchSellable(
      {
        expiresAt: expiresToday,
        quantityRemaining: 3,
        status: InventoryBatchStatus.AVAILABLE
      },
      businessNow
    ),
    true
  );
  assert.equal(
    isBatchSellable(
      {
        expiresAt: expiredYesterday,
        quantityRemaining: 3,
        status: InventoryBatchStatus.AVAILABLE
      },
      businessNow
    ),
    false
  );
});

test("zero, depleted, and removed quantities never become sellable stock", () => {
  const truth = calculateStockTruth(
    [
      {
        expiresAt: null,
        quantityRemaining: 0,
        status: InventoryBatchStatus.AVAILABLE
      },
      {
        expiresAt: null,
        quantityRemaining: 8,
        status: InventoryBatchStatus.DEPLETED
      },
      {
        expiresAt: null,
        quantityRemaining: 4,
        status: InventoryBatchStatus.REMOVED
      }
    ],
    businessNow
  );

  assert.equal(truth.physicalOnHand, 12);
  assert.equal(truth.sellableStock, 0);
  assert.equal(truth.sellableBatchCount, 0);
});
