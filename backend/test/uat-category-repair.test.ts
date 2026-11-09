import assert from "node:assert/strict";
import test from "node:test";

import { proposedUatCategoryCorrection } from "../src/modules/catalog/uat-category-repair.js";

test("D01 moves tissues and paper goods out of baking and desserts", () => {
  assert.equal(
    proposedUatCategoryCorrection({
      currentCategorySlug: "baking-dessert",
      productName: "Bathroom Tissue Roll Pack"
    }),
    "tissue-cotton"
  );
  assert.equal(
    proposedUatCategoryCorrection({
      currentCategorySlug: "baking-dessert",
      productName: "Paper Towels"
    }),
    "tissue-cotton"
  );
});

test("D01 corrects historically miscategorized baking snacks using source evidence", () => {
  assert.equal(
    proposedUatCategoryCorrection({
      currentCategorySlug: "baking-dessert",
      productName: "Jack n Jill Piattos Cheese",
      sourceProductId: "P370"
    }),
    "snacks-confectionery"
  );
  assert.equal(
    proposedUatCategoryCorrection({
      currentCategorySlug: "baking-dessert",
      productName: "Pancit Canton",
      sourceProductId: "P326"
    }),
    "noodles-pasta"
  );
});

test("D01 separates fresh dairy from frozen foods without relocating ice cream", () => {
  assert.equal(
    proposedUatCategoryCorrection({
      currentCategorySlug: "frozen-chilled",
      productName: "Fresh Whole Milk 1L"
    }),
    "dairy-products"
  );
  assert.equal(
    proposedUatCategoryCorrection({
      currentCategorySlug: "frozen-chilled",
      productName: "Cheese Hotdog Pack"
    }),
    null
  );
  assert.equal(
    proposedUatCategoryCorrection({
      currentCategorySlug: "frozen-chilled",
      productName: "Chocolate Ice Cream"
    }),
    null
  );
});

test("D01 leaves correctly filed products and uncertain baking ingredients untouched", () => {
  assert.equal(
    proposedUatCategoryCorrection({
      currentCategorySlug: "baking-dessert",
      productName: "White Sugar 1/2 kilo"
    }),
    null
  );
  assert.equal(
    proposedUatCategoryCorrection({
      currentCategorySlug: "tissue-cotton",
      productName: "Bathroom Tissue Roll Pack"
    }),
    null
  );
});
