import assert from "node:assert/strict";

import {
  hasLikelyMojibake,
  normalizeProductName
} from "../backend/src/utils/productNameNormalizer";

const correctedDash = normalizeProductName("Bonna Infant Formula 0Ã¢â‚¬â€œ6 Months");

assert.equal(correctedDash, "Bonna Infant Formula 0–6 Months");
assert.equal(
  normalizeProductName("Bonna Infant Formula 0–6 Months"),
  "Bonna Infant Formula 0–6 Months"
);
assert.equal(normalizeProductName("MenÃ¢â‚¬â„¢s"), "Men’s");
assert.equal(normalizeProductName("Men’s"), "Men’s");
assert.equal(normalizeProductName("Ã¢â‚¬Å“PremiumÃ¢â‚¬Â"), "“Premium”");
assert.equal(normalizeProductName("Crème Brûlée Niño"), "Crème Brûlée Niño");
assert.equal(normalizeProductName(null), "");
assert.equal(normalizeProductName(undefined), "");
assert.equal(normalizeProductName("  Bonna   Infant Formula  "), "Bonna Infant Formula");
assert.equal(normalizeProductName(correctedDash), correctedDash);
assert.equal(normalizeProductName("AÃ¢â‚¬â€B"), "A—B");
assert.equal(hasLikelyMojibake("Bonna Infant Formula 0Ã¢â‚¬â€œ6 Months"), true);
assert.equal(hasLikelyMojibake("Bonna Infant Formula 0–6 Months"), false);
