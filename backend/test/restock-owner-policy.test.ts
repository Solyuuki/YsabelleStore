import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  findInflatedAutomatedLine,
  isAutomatedMonthlyOrder,
  type RestockLineIntegrity
} from "../src/services/restockApprovalPolicy.js";
import { approveRestockOrderSchema } from "../src/validators/restock.validators.js";

const baseLine: RestockLineIntegrity = {
  isSelected: true,
  productId: "p1",
  recommendationSource: "SARIMA",
  recommendedQuantity: 17,
  requestedQuantity: 17,
  receivedQuantity: 0,
  ownerOverrideReason: null
};

test("historical 202270-unit automated tickets remain quarantined", () => {
  const line = { ...baseLine, recommendedQuantity: 202_270, requestedQuantity: 202_270 };
  assert.deepEqual(findInflatedAutomatedLine("[AutomatedRestockMonth:2026-10]", [line]), {
    productId: "p1",
    reason: "AUTOMATED_QUANTITY_OUT_OF_BOUNDS"
  });
  assert.deepEqual(findInflatedAutomatedLine("[AutomatedRestock:legacy]", [line]), {
    productId: "p1",
    reason: "AUTOMATED_QUANTITY_OUT_OF_BOUNDS"
  });
  assert.equal(findInflatedAutomatedLine("Owner manual restock", [line]), null);
  assert.equal(isAutomatedMonthlyOrder("Owner manual restock"), false);
});

test("approved normal automated batch remains valid independent of later live forecasts", () => {
  assert.equal(findInflatedAutomatedLine("[AutomatedRestockMonth:2026-10]", [baseLine]), null);
  assert.equal(
    findInflatedAutomatedLine("[AutomatedRestockMonth:2026-10]", [
      { ...baseLine, requestedQuantity: 40 }
    ])?.reason,
    "AUTOMATED_REQUEST_EXCEEDS_SAVED_BASELINE"
  );
  // An Owner-added MANUAL line remains an Owner decision even in a mixed batch.
  assert.equal(
    findInflatedAutomatedLine("[AutomatedRestockMonth:2026-10]", [
      baseLine,
      {
        ...baseLine,
        recommendationSource: "MANUAL",
        recommendedQuantity: 0,
        requestedQuantity: 300
      }
    ]),
    null
  );
});

test("Owner purchasing warning acknowledgment is explicit and optional by default", () => {
  assert.deepEqual(approveRestockOrderSchema.parse({ expectedVersion: 3 }), {
    expectedVersion: 3,
    acknowledgeWarnings: false
  });
  assert.deepEqual(
    approveRestockOrderSchema.parse({ expectedVersion: 3, acknowledgeWarnings: true }),
    { expectedVersion: 3, acknowledgeWarnings: true }
  );
});

test("Receiving bypasses live procurement policy but retains anomaly checks and stock transaction", () => {
  const restock = readFileSync(
    new URL("../src/services/restockService.ts", import.meta.url),
    "utf8"
  );
  const lifecycle = readFileSync(
    new URL("../src/services/restockLifecycleService.ts", import.meta.url),
    "utf8"
  );
  assert.match(restock, /findInflatedAutomatedLine\(snapshot\.notes, selectedLines\)/);
  assert.match(
    restock,
    /if \(stage === "RECEIPT" \|\| isAutomatedMonthlyOrder\(snapshot\.notes\)\) return \[\]/
  );
  assert.match(restock, /RESTOCK_OWNER_WARNING_ACK_REQUIRED/);
  assert.match(restock, /OwnerPurchaseWarningsAcknowledged/);
  assert.match(lifecycle, /RESTOCK_OVER_DELIVERY_NOT_AUTHORIZED/);
  assert.match(lifecycle, /RESTOCK_RECEIPT_VERSION_CONFLICT/);
  assert.match(lifecycle, /await receiveStockInTransaction\(/);
});
