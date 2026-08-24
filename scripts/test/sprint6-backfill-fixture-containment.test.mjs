import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { fixtureCategoryEvidence, fixtureProductEvidence } from "../lib/catalog-quality.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const BACKFILL_CASES = ["Eligible", "Existing", "Dry Run", "Apply"];

for (const label of BACKFILL_CASES) {
  test(`Sprint 6 ${label} backfill categories are recognized as test fixtures`, () => {
    const category = { name: `Backfill ${label} ca5ed835` };

    assert.deepEqual(fixtureCategoryEvidence(category), ["CIQE_BACKFILL_TEST"]);
    assert.deepEqual(
      fixtureProductEvidence({
        barcode: null,
        category,
        name: `Backfill ${label} Product ca5ed835`,
        sku: "fixture"
      }),
      ["FIXTURE_CATEGORY:CIQE_BACKFILL_TEST"]
    );
  });
}

test("normal catalog categories are not classified as Sprint 6 backfill fixtures", () => {
  assert.deepEqual(fixtureCategoryEvidence({ name: "Canned Goods" }), []);
  assert.deepEqual(fixtureCategoryEvidence({ name: "Backfill Existing" }), []);
  assert.deepEqual(fixtureCategoryEvidence({ name: "Backfill Existing real-store" }), []);
});

test("Sprint 6 backfill database fixtures are non-storefront test data", () => {
  const source = fs.readFileSync(
    path.join(REPO_ROOT, "backend", "test", "catalog-image-backfill.test.ts"),
    "utf8"
  );

  assert.equal((source.match(/recordSource: "CATALOG"/g) ?? []).length, 0);
  assert.ok((source.match(/recordSource: "TEST_FIXTURE"/g) ?? []).length >= 4);
  assert.equal((source.match(/isStorefrontVisible: true/g) ?? []).length, 0);
  assert.ok((source.match(/isStorefrontVisible: false/g) ?? []).length >= 4);
});

test("backend workspace tests always include the Sprint 6 backfill regression", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "backend", "package.json"), "utf8")
  );

  assert.match(packageJson.scripts.test, /test\/catalog-image-backfill\.test\.ts/);
});
