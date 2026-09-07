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

test("storefront taxonomy exposes fourteen clean public categories in UX order", () => {
  assert.equal(STOREFRONT_CATEGORY_TAXONOMY.length, 14);
  assert.deepEqual(STOREFRONT_CATEGORY_NAMES, [
    "Coffee & Milk",
    "Juice, Tea, Soda & Water",
    "Bread & Bakery",
    "Baking & Dessert",
    "Canned Goods",
    "Condiments & Cooking",
    "Noodles & Pasta",
    "Rice & Staples",
    "Snacks & Confectionery",
    "Frozen & Chilled",
    "Household Supplies",
    "Laundry Supplies",
    "Personal Care & Hygiene",
    "Tissue & Cotton"
  ]);
  assert.equal(STOREFRONT_CATEGORY_NAMES.some((name) => name.includes("/")), false);
});

test("canonical source categories map to clean public labels", () => {
  assert.equal(storefrontCategoryForSource("Beverages / Coffee & Milk")?.name, "Coffee & Milk");
  assert.equal(
    storefrontCategoryForSource("Beverages / Juice, Tea, Soda & Water")?.name,
    "Juice, Tea, Soda & Water"
  );
  assert.equal(
    storefrontCategoryForSource("Baking / Spreads & Dessert Ingredients")?.name,
    "Baking & Dessert"
  );
  assert.equal(
    storefrontCategoryForSource("Condiments & Cooking Ingredients")?.name,
    "Condiments & Cooking"
  );
  assert.equal(
    storefrontCategoryForSource("Snacks / Biscuits & Confectionery")?.name,
    "Snacks & Confectionery"
  );
  assert.equal(
    storefrontCategoryForSource("Personal Care / Hygiene")?.name,
    "Personal Care & Hygiene"
  );
});

test("restricted alcohol is intentionally outside the public taxonomy", () => {
  assert.equal(RESTRICTED_ALCOHOL_SOURCE_CATEGORY, "Beverages / Alcohol");
  assert.deepEqual(RESTRICTED_ALCOHOL_SOURCE_PRODUCT_IDS, ["P254", "P255"]);
  assert.equal(storefrontCategoryForSource(RESTRICTED_ALCOHOL_SOURCE_CATEGORY), null);
  assert.equal(STOREFRONT_CATEGORY_NAMES.some((name) => /alcohol/i.test(name)), false);
});

test("category comparator preserves logical merchandising order", () => {
  const shuffled = [
    "Tissue & Cotton",
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
    "Tissue & Cotton"
  ]);
});
