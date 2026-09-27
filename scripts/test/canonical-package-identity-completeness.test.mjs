import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const state = JSON.parse(readFileSync("database/prisma/state/canonical-state.json", "utf8"));
const release = JSON.parse(readFileSync(state.canonicalReleasePath, "utf8"));
const identities = JSON.parse(readFileSync("database/canonical/product-identities.json", "utf8"));

test("active canonical release has complete package-size identities", () => {
  assert.equal(release.products.length, 50);
  assert.equal(identities.items.length, 50);

  const identityByCode = new Map(identities.items.map((item) => [item.sourceProductId, item]));

  for (const product of release.products) {
    const code = product.sourceProductId;
    assert.notEqual(product.sizeValue, null, `${code} release sizeValue is missing`);
    assert.notEqual(product.sizeUnit, null, `${code} release sizeUnit is missing`);
    assert.ok(Number(product.sizeValue) > 0, `${code} release sizeValue is invalid`);

    const identity = identityByCode.get(code);
    assert.ok(identity, `${code} identity manifest row is missing`);
    assert.equal(identity.sizeValue, product.sizeValue);
    assert.equal(identity.sizeUnit, product.sizeUnit);
  }
});
