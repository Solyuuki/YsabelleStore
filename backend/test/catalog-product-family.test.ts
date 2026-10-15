import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductSizeFamilyKey,
  verifiedProductSizeFamilyId
} from "../src/utils/catalogIdentity.js";

const classic = {
  brand: "Gardenia",
  name: "Gardenia Classic Enriched White Bread 400g",
  variant: "Classic Enriched White",
  sizeUnit: "GRAM" as const,
  sizeValue: "400"
};
const enriched = {
  brand: "Gardenia",
  name: "Gardenia Enriched White Bread 600g",
  variant: "Enriched White",
  sizeUnit: "GRAM" as const,
  sizeValue: "600"
};

test("verified Gardenia Classic/Enriched White sizes resolve to one family", () => {
  assert.equal(verifiedProductSizeFamilyId(classic), "ysfam-gardenia-enriched-white");
  assert.equal(verifiedProductSizeFamilyId(enriched), "ysfam-gardenia-enriched-white");
  assert.equal(buildProductSizeFamilyKey(classic), buildProductSizeFamilyKey(enriched));
});

test("generic variant names do not link unrelated product lines", () => {
  const base = { brand: "Sample Brand", variant: "Original" };
  assert.notEqual(
    buildProductSizeFamilyKey({ ...base, name: "Sample Brand Cookies 100g" }),
    buildProductSizeFamilyKey({ ...base, name: "Sample Brand Crackers 200g" })
  );
});

test("unverified Gardenia lines and naming discrepancies do not silently merge", () => {
  assert.notEqual(
    buildProductSizeFamilyKey(classic),
    buildProductSizeFamilyKey({
      brand: "Gardenia",
      name: "Gardenia High Fiber Whole Wheat Bread 600g",
      variant: "Enriched White"
    })
  );
  assert.equal(
    verifiedProductSizeFamilyId({
      ...enriched,
      brand: "Other Brand"
    }),
    null
  );
});
