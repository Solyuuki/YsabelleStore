import assert from "node:assert/strict";
import test from "node:test";

import { summarizeMonthlyRestockActions } from "../src/services/dashboardMonthlyRestockSummary.js";

test("monthly batch distinguishes restock purchases from expiry and overstock reviews", () => {
  const actions = [
    { actionType: "RESTOCK", recommendedQuantity: 17 },
    ...Array.from({ length: 4 }, () => ({
      actionType: "EXPIRY_REVIEW" as const,
      recommendedQuantity: 0
    })),
    ...Array.from({ length: 3 }, () => ({
      actionType: "REDUCE_REPLENISHMENT" as const,
      recommendedQuantity: 0
    }))
  ] as const;

  assert.deepEqual(summarizeMonthlyRestockActions(actions), {
    restockProducts: 1,
    otherReviewProducts: 7,
    suggestedUnits: 17
  });
});

test("batch totals include all products, not only five visible Dashboard preview actions", () => {
  const actions = [
    { actionType: "RESTOCK", recommendedQuantity: 12 },
    { actionType: "RESTOCK", recommendedQuantity: 7 },
    ...Array.from({ length: 15 }, () => ({
      actionType: "EXPIRY_REVIEW" as const,
      recommendedQuantity: 0
    }))
  ] as const;
  assert.deepEqual(summarizeMonthlyRestockActions(actions), {
    restockProducts: 2,
    otherReviewProducts: 15,
    suggestedUnits: 19
  });
});

test("empty and non-purchasing batches do not imply a supplier order", () => {
  assert.deepEqual(summarizeMonthlyRestockActions([]), {
    restockProducts: 0,
    otherReviewProducts: 0,
    suggestedUnits: 0
  });

  assert.deepEqual(
    summarizeMonthlyRestockActions([
      { actionType: "EXPIRY_REVIEW", recommendedQuantity: 0 },
      { actionType: "REDUCE_REPLENISHMENT", recommendedQuantity: 0 }
    ]),
    { restockProducts: 0, otherReviewProducts: 2, suggestedUnits: 0 }
  );
});
