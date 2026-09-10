import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCustomerMobileIdentityBackfillSummary,
  planCustomerMobileIdentityBackfill
} from "../src/scripts/backfillCustomerMobileIdentities.js";

const LEGACY_ROWS = [
  { id: "a", phone: "09171234567" },
  { id: "b", phone: "09981234567" },
  { id: "c", phone: "+63 917 123 4567" },
  { id: "d", phone: "not-a-phone" },
  { id: "e", phone: null }
];

test("plans updates only for unique canonical Philippine mobile identities", () => {
  const plan = planCustomerMobileIdentityBackfill(LEGACY_ROWS);

  assert.deepEqual(plan.updates, [
    {
      id: "b",
      phoneNormalized: "+639981234567"
    }
  ]);

  assert.deepEqual(plan.duplicateIds, ["a", "c"]);
  assert.deepEqual(plan.invalidIds, ["d"]);
  assert.deepEqual(plan.emptyIds, ["e"]);
});

test("treats equivalent legacy phone representations as ambiguous and never updates either row", () => {
  const plan = planCustomerMobileIdentityBackfill([
    { id: "first", phone: "09171234567" },
    { id: "second", phone: "+639171234567" }
  ]);

  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.duplicateIds, ["first", "second"]);
  assert.equal(plan.summary.duplicate, 2);
  assert.equal(plan.summary.validUnique, 0);
});

test("produces metadata-only summary counts without customer phone values", () => {
  const plan = planCustomerMobileIdentityBackfill(LEGACY_ROWS);

  assert.deepEqual(plan.summary, {
    scanned: 5,
    validUnique: 1,
    duplicate: 2,
    invalid: 1,
    empty: 1
  });

  const output = formatCustomerMobileIdentityBackfillSummary(plan.summary, "dry-run");

  assert.match(output, /Customer mobile identity backfill/);
  assert.match(output, /scanned=5 valid_unique=1 duplicate=2 invalid=1 empty=1/);
  assert.match(output, /mode=dry-run/);

  for (const sensitiveValue of [
    "09171234567",
    "09981234567",
    "+63 917 123 4567",
    "+639171234567",
    "+639981234567",
    "not-a-phone"
  ]) {
    assert.equal(output.includes(sensitiveValue), false);
  }
});

test("reports apply mode without changing the metadata-only output contract", () => {
  const plan = planCustomerMobileIdentityBackfill(LEGACY_ROWS);
  const output = formatCustomerMobileIdentityBackfillSummary(plan.summary, "apply");

  assert.match(output, /mode=apply/);
  assert.equal(output.includes("+639"), false);
  assert.equal(output.includes("0917"), false);
});
