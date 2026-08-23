import assert from "node:assert/strict";
import test from "node:test";

import {
  isMatchingCiqeBackfillFixtureProduct,
  parseCiqeBackfillFixtureCategory
} from "../lib/ciqe-backfill-fixtures.mjs";

test("matches only exact Sprint 6 CIQE backfill category and product signatures", () => {
  const parsed = parseCiqeBackfillFixtureCategory({
    name: "Backfill Existing ca5ed835",
    slug: "backfill-existing-ca5ed835"
  });

  assert.deepEqual(parsed, { label: "EXISTING", suffix: "ca5ed835" });
  assert.equal(
    isMatchingCiqeBackfillFixtureProduct(
      {
        name: "Backfill Existing Product ca5ed835",
        sku: "BACKFILL-EXISTING-ca5ed835"
      },
      parsed
    ),
    true
  );
});

test("rejects near matches and mismatched suffixes", () => {
  const invalidCategories = [
    { name: "Canned Goods", slug: "canned-goods" },
    { name: "Backfill Existing", slug: "backfill-existing" },
    { name: "Backfill Existing real-store", slug: "backfill-existing-real-store" },
    { name: "Backfill Existing ca5ed835", slug: "other-ca5ed835" }
  ];

  for (const category of invalidCategories) {
    assert.equal(parseCiqeBackfillFixtureCategory(category), null);
  }

  const fixture = { label: "EXISTING", suffix: "ca5ed835" };
  assert.equal(
    isMatchingCiqeBackfillFixtureProduct(
      { name: "Backfill Existing Product deadbeef", sku: "BACKFILL-EXISTING-deadbeef" },
      fixture
    ),
    false
  );
});
