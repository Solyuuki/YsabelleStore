import assert from "node:assert/strict";
import test from "node:test";

import {
  RESTRICTED_ALCOHOL_SOURCE_CATEGORY,
  RESTRICTED_ALCOHOL_SOURCE_PRODUCT_IDS,
  STOREFRONT_CATEGORY_NAMES,
  STOREFRONT_CATEGORY_TAXONOMY,
  compareStorefrontCategoryNames,
  storefrontCategoryForSource
} from "../src/modules/catalog/storefront-category-taxonomy.js";

test("storefront taxonomy exposes fifteen clear public categories in UX order", () => {
  assert.equal(STOREFRONT_CATEGORY_TAXONOMY.length, 15);
  assert.deepEqual(STOREFRONT_CATEGORY_NAMES, [
    "Coffee & Milk",
    "Drinks & Beverages",
    "Dairy & Eggs",
    "Bread & Bakery",
    "Baking Essentials",
    "Canned Goods",
    "Cooking Essentials",
    "Noodles & Pasta",
    "Rice & Staples",
    "Snacks & Sweets",
    "Frozen Foods",
    "Household Supplies",
    "Laundry Supplies",
    "Personal Care Essentials",
    "Tissue & Paper"
  ]);
  assert.equal(
    STOREFRONT_CATEGORY_NAMES.some((name) => name.includes("/")),
    false
  );
});

test("canonical source categories map to clean public labels", () => {
  assert.equal(storefrontCategoryForSource("Beverages / Coffee & Milk")?.name, "Coffee & Milk");
  assert.equal(
    storefrontCategoryForSource("Beverages / Juice, Tea, Soda & Water")?.name,
    "Drinks & Beverages"
  );
  assert.equal(
    storefrontCategoryForSource("Baking / Spreads & Dessert Ingredients")?.name,
    "Baking Essentials"
  );
  assert.equal(
    storefrontCategoryForSource("Condiments & Cooking Ingredients")?.name,
    "Cooking Essentials"
  );
  assert.equal(
    storefrontCategoryForSource("Snacks / Biscuits & Confectionery")?.name,
    "Snacks & Sweets"
  );
  assert.equal(
    storefrontCategoryForSource("Personal Care / Hygiene")?.name,
    "Personal Care Essentials"
  );
});

test("D01 dairy category is distinct from cheese-flavored snacks", () => {
  assert.ok(STOREFRONT_CATEGORY_NAMES.includes("Dairy & Eggs"));
  assert.ok(STOREFRONT_CATEGORY_NAMES.includes("Snacks & Sweets"));
});

test("restricted alcohol is intentionally outside the public taxonomy", () => {
  assert.equal(RESTRICTED_ALCOHOL_SOURCE_CATEGORY, "Beverages / Alcohol");
  assert.deepEqual(RESTRICTED_ALCOHOL_SOURCE_PRODUCT_IDS, ["P254", "P255"]);
  assert.equal(storefrontCategoryForSource(RESTRICTED_ALCOHOL_SOURCE_CATEGORY), null);
  assert.equal(
    STOREFRONT_CATEGORY_NAMES.some((name) => /alcohol/i.test(name)),
    false
  );
});

test("category comparator preserves logical merchandising order", () => {
  const shuffled = [
    "Tissue & Paper",
    "Canned Goods",
    "Coffee & Milk",
    "Bread & Bakery",
    "Laundry Supplies"
  ];
  assert.deepEqual(shuffled.sort(compareStorefrontCategoryNames), [
    "Coffee & Milk",
    "Bread & Bakery",
    "Canned Goods",
    "Laundry Supplies",
    "Tissue & Paper"
  ]);
});
