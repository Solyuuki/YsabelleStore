import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma, ProductVatCategory } from "@prisma/client";

import { calculatePosVatBreakdown } from "../src/services/posVatService.js";

const line = (amount: string, vatCategory: ProductVatCategory) => ({
  grossAmount: new Prisma.Decimal(amount),
  vatCategory
});

test("VAT-inclusive price 112 equals 100 net and 12 VAT", () => {
  const result = calculatePosVatBreakdown([line("112.00", ProductVatCategory.VATABLE)]);
  assert.equal(result.vatableSalesAmount.toFixed(2), "100.00");
  assert.equal(result.vatAmount.toFixed(2), "12.00");
  assert.equal(result.vatableSalesAmount.add(result.vatAmount).toFixed(2), "112.00");
});

test("mixed VATable, exempt and zero-rated sales reconcile", () => {
  const result = calculatePosVatBreakdown([
    line("112.00", ProductVatCategory.VATABLE),
    line("80.00", ProductVatCategory.VAT_EXEMPT),
    line("50.00", ProductVatCategory.ZERO_RATED)
  ]);
  assert.equal(result.vatAmount.toFixed(2), "12.00");
  assert.equal(result.vatExemptSalesAmount.toFixed(2), "80.00");
  assert.equal(result.zeroRatedSalesAmount.toFixed(2), "50.00");
  const reconstructedTotal = result.vatableSalesAmount
    .add(result.vatAmount)
    .add(result.vatExemptSalesAmount)
    .add(result.zeroRatedSalesAmount);
  assert.equal(reconstructedTotal.toFixed(2), "242.00");
});

test("cent rounding preserves total", () => {
  const result = calculatePosVatBreakdown([line("99.99", ProductVatCategory.VATABLE)]);
  assert.equal(result.vatableSalesAmount.toFixed(2), "89.28");
  assert.equal(result.vatAmount.toFixed(2), "10.71");
});

test("unclassified products cannot silently become 12% VATable", () => {
  assert.throws(
    () => calculatePosVatBreakdown([line("10.00", ProductVatCategory.UNCLASSIFIED)]),
    /category approval/
  );
});
