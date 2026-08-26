import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fixtureCategoryEvidence,
  fixtureProductEvidence
} from "../lib/catalog-quality.mjs";

test("customer-order integration fixtures are classified as test data", () => {
  const suffix = "0110af20";
  const category = {
    name: `Customer Order Test ${suffix}`
  };
  const product = {
    barcode: null,
    category,
    name: `Customer Order Product ${suffix}`,
    sku: `CUSTOMER-ORDER-${suffix}`
  };

  assert.deepEqual(fixtureCategoryEvidence(category), ["CUSTOMER_ORDER_TEST"]);
  assert.deepEqual(fixtureProductEvidence(product), [
    "FIXTURE_CATEGORY:CUSTOMER_ORDER_TEST",
    "CUSTOMER_ORDER_GENERATOR_SIGNATURE"
  ]);
});
