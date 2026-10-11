import assert from "node:assert/strict";
import test from "node:test";

import { parseWholeUnitQuantity, isWholeUnitDraft, requireWholeUnitQuantity } from "../../frontend/src/utils/wholeUnitQuantity.js";

test("whole-unit parser rejects decimals, exponent, unsafe values and negatives without rounding", () => {
  for (const v of ["1.4", "3.4", "-1", "1e3", "2,000", "", "NaN", "Infinity", "9007199254740992"]) {
    assert.equal(parseWholeUnitQuantity(v), null, v);
    assert.equal(isWholeUnitDraft(v), v === "", v);
  }
  for (const v of [0, 1, 17, 999, 9007199254740991]) {
    assert.equal(parseWholeUnitQuantity(v), v);
    assert.equal(parseWholeUnitQuantity(String(v)), v);
  }
  for (const v of [1.4, 3.4, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
    assert.equal(parseWholeUnitQuantity(v), null);
  }
  assert.equal(isWholeUnitDraft(""), true);
  assert.equal(isWholeUnitDraft("01"), true);
  assert.equal(requireWholeUnitQuantity("3", "Delivered", 1), 3);
  assert.throws(() => requireWholeUnitQuantity("3.4", "Delivered"), /whole number/);
  assert.throws(() => requireWholeUnitQuantity("0", "Delivered", 1), /whole number/);
});

