import assert from "node:assert/strict";
import test from "node:test";

import { identifySprint6BackfillFixture } from "../lib/sprint6-backfill-fixtures.mjs";

test("identifies the leaked Sprint 6 Backfill Existing fixture exactly", () => {
  assert.deepEqual(
    identifySprint6BackfillFixture({
      categoryName: "Backfill Existing ca5ed835",
      name: "Backfill Existing Product ca5ed835",
      sku: "BACKFILL-EXISTING-ca5ed835"
    }),
    { kind: "existing", suffix: "ca5ed835" }
  );
});

test("identifies all known Sprint 6 backfill generator signatures", () => {
  for (const [label, slug] of [
    ["Eligible", "eligible"],
    ["Existing", "existing"],
    ["Dry Run", "dry-run"],
    ["Apply", "apply"]
  ]) {
    assert.deepEqual(
      identifySprint6BackfillFixture({
        categoryName: `Backfill ${label} deadbeef`,
        name: `Backfill ${label} Product deadbeef`,
        sku: `BACKFILL-${slug.toUpperCase()}-deadbeef`
      }),
      { kind: slug, suffix: "deadbeef" }
    );
  }
});

test("does not classify partial or mismatched real catalog records as fixtures", () => {
  const candidates = [
    {
      categoryName: "Backfill Existing ca5ed835",
      name: "Ligo Sardines in Tomato Sauce, Chili Added 155g",
      sku: "P144"
    },
    {
      categoryName: "Backfill Existing ca5ed835",
      name: "Backfill Existing Product deadbeef",
      sku: "BACKFILL-EXISTING-deadbeef"
    },
    {
      categoryName: "Canned Goods",
      name: "Backfill Existing Product ca5ed835",
      sku: "BACKFILL-EXISTING-ca5ed835"
    },
    {
      categoryName: "Backfill Existing real-store",
      name: "Backfill Existing Product real-store",
      sku: "BACKFILL-EXISTING-real-store"
    }
  ];

  for (const candidate of candidates) {
    assert.equal(identifySprint6BackfillFixture(candidate), null);
  }
});
