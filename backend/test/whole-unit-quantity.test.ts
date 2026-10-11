import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { parseWholeUnitQuantity, isWholeUnitDraft, requireWholeUnitQuantity } from "../../frontend/src/utils/wholeUnitQuantity.js";
import { posCheckoutItemSchema } from "../src/validators/pos.validators.js";
import { customerCartQuantitySchema } from "../src/validators/customerCart.validators.js";
import { stockInSchema, stockAdjustSchema } from "../src/validators/inventory.validators.js";
import { storefrontOrderSchema } from "../src/validators/storefront.validators.js";
import { receiveRestockOrderSchema } from "../src/validators/restock.validators.js";
import { completeBulkDeliverySchema } from "../src/validators/bulkDelivery.validators.js";

test("whole-unit parser rejects decimals, exponent, unsafe values and negatives without rounding", () => {
  for (const v of ["1.4", "3.4", "-1", "1e3", "2,000", "", "NaN", "Infinity", "9007199254740992"]) {
    assert.equal(parseWholeUnitQuantity(v), null, v);
    assert.equal(isWholeUnitDraft(v), v === "", v);
  }
  for (const v of [0, 1, 17, 999, 9007199254740991]) {
    assert.equal(parseWholeUnitQuantity(v), v);
    assert.equal(parseWholeUnitQuantity(String(v)), v);
  }
  for (const v of [1.4, 3.4, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
    assert.equal(parseWholeUnitQuantity(v), null);
  }
  assert.equal(isWholeUnitDraft(""), true);
  assert.equal(isWholeUnitDraft("01"), true);
  assert.equal(requireWholeUnitQuantity("3", "Delivered", 1), 3);
  assert.throws(() => requireWholeUnitQuantity("3.4", "Delivered"), /whole number/);
  assert.throws(() => requireWholeUnitQuantity("0", "Delivered", 1), /whole number/);
});

test("Storefront, POS and customer cart APIs reject fractional quantities", () => {
  assert.equal(posCheckoutItemSchema.safeParse({ productId: "p1", quantity: 1.4 }).success, false);
  assert.equal(customerCartQuantitySchema.safeParse({ quantity: 1.4 }).success, false);
  assert.equal(customerCartQuantitySchema.safeParse({ quantity: 2 }).success, true);
  const draft = {
    customerName: "Test Customer",
    customerPhone: "09171234567",
    customerAddress: {},
    fulfillmentMethod: "DELIVERY",
    paymentMethod: "CASH_ON_DELIVERY",
    items: [{ productId: "p1", quantity: 1.4 }]
  };
  const result = storefrontOrderSchema.safeParse(draft);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some(issue => issue.path.includes("quantity")));
  }
});

test("Inventory mutation validators reject fractions while accepting whole units", () => {
  const stockIn = { quantity: 1.4, batchCode: "LOT-QA", expiresAt: null };
  assert.equal(stockInSchema.safeParse(stockIn).success, false);
  assert.equal(stockInSchema.safeParse({ ...stockIn, quantity: 3 }).success, true);
  const adjustment = { movementType: "ADJUSTMENT_IN", quantity: 3.4, reason: "QA" };
  assert.equal(stockAdjustSchema.safeParse(adjustment).success, false);
  assert.equal(stockAdjustSchema.safeParse({ ...adjustment, quantity: 3 }).success, true);
});

test("core stock-write services reject noninteger units before any database operation", () => {
  const source = readFileSync(new URL("../src/services/stockDomainService.ts", import.meta.url), "utf8");
  for (const functionName of [
    "createOpeningStockBatch",
    "stockInBatch",
    "applyStockAdjustment",
    "allocateStockForSale"
  ]) {
    const functionStart = source.indexOf("export async function " + functionName + "(");
    assert.ok(functionStart >= 0, functionName + " missing");
    const nextFunction = source.indexOf("\nexport ", functionStart + 30);
    const snippet = source.slice(functionStart, nextFunction === -1 ? undefined : nextFunction);
    assert.match(snippet, /Number\.isSafeInteger\(input\.quantity\)/);
  }
});

test("restock receipts and bulk delivery reject decimals, preserving amounts and costs separately", () => {
  const receipt = receiveRestockOrderSchema.safeParse({
    expectedVersion: 1,
    lines: [{ lineId: "l1", deliveredQuantity: 3.4, damagedQuantity: 0, acceptedQuantity: 0 }]
  });
  assert.equal(receipt.success, false);
  if (!receipt.success) {
    assert.ok(receipt.error.issues.some(issue => issue.path.includes("deliveredQuantity")));
  }

  const bulk = completeBulkDeliverySchema.safeParse({
    sourceType: "MANUAL",
    rows: [{ productId: "p1", receivedQuantity: 3.4, damagedQuantity: 0 }]
  });
  assert.equal(bulk.success, false);
  if (!bulk.success) {
    assert.ok(bulk.error.issues.some(issue => issue.path.includes("receivedQuantity")));
  }
});
