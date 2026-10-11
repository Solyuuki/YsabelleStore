import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);

function parseRawTuples(source) {
  const rows = [];
  let row = [];
  let current = "";
  let quoted = false;
  let escaped = false;
  let depth = 0;

  const push = () => {
    row.push(current.trim());
    current = "";
  };

  for (const character of source) {
    if (quoted) {
      current += character;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === "'") quoted = false;
      continue;
    }

    if (character === "'") {
      quoted = true;
      current += character;
      continue;
    }
    if (character === "(") {
      if (depth === 0) {
        row = [];
        current = "";
      } else {
        current += character;
      }
      depth += 1;
      continue;
    }
    if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        push();
        rows.push(row);
        row = [];
        current = "";
      } else {
        current += character;
      }
      continue;
    }
    if (character === "," && depth === 1) {
      push();
      continue;
    }
    if (depth >= 1) current += character;
  }

  return rows;
}

function unquote(value) {
  if (value === "NULL") return null;
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("\\'", "'").replaceAll("\\\\", "\\");
  }
  return value;
}

test("canonical 50 identity manifest is complete and matches the active release", async () => {
  const [manifestText, stateText, seedSql] = await Promise.all([
    readFile(new URL("database/canonical/product-identities.json", ROOT), "utf8"),
    readFile(new URL("database/prisma/state/canonical-state.json", ROOT), "utf8"),
    readFile(new URL("database/seed/canonical-catalog-v1.sql", ROOT), "utf8")
  ]);
  const manifest = JSON.parse(manifestText);
  const state = JSON.parse(stateText);
  const releaseText = await readFile(new URL(state.canonicalReleasePath, ROOT), "utf8");
  const release = JSON.parse(releaseText);

  assert.equal(release.releaseId, state.releaseId);
  assert.equal(release.catalogVersion, state.catalogVersion);
  assert.equal(manifest.releaseId, state.releaseId);
  assert.equal(manifest.catalogVersion, state.catalogVersion);
  assert.equal(manifest.items.length, 50);
  assert.equal(release.products.length, 50);

  const manifestByCode = new Map(manifest.items.map((item) => [item.sourceProductId, item]));
  for (const product of release.products) {
    const identity = manifestByCode.get(product.sourceProductId);
    assert.ok(identity, `${product.sourceProductId} missing identity manifest entry`);
    assert.ok(product.brand?.trim(), `${product.sourceProductId} missing brand`);
    assert.ok(product.variant?.trim(), `${product.sourceProductId} missing variant`);
    assert.equal(product.brand, identity.brand);
    assert.equal(product.variant, identity.variant);
    assert.equal(product.sizeValue ?? null, identity.sizeValue ?? null);
    assert.equal(product.sizeUnit ?? null, identity.sizeUnit ?? null);
    assert.equal(Boolean(product.sizeValue), Boolean(product.sizeUnit));
  }

  const insertStart = seedSql.indexOf("INSERT INTO `products`");
  const valuesStart = seedSql.indexOf(" VALUES ", insertStart) + " VALUES ".length;
  const valuesEnd = seedSql.indexOf(";\nUNLOCK TABLES", valuesStart);
  assert.ok(insertStart >= 0 && valuesStart > 0 && valuesEnd > valuesStart);
  const rows = parseRawTuples(seedSql.slice(valuesStart, valuesEnd));
  const bySku = new Map(
    rows.filter((row) => row.length === 23).map((row) => [unquote(row[3]), row])
  );

  for (const identity of manifest.items) {
    const row = bySku.get(identity.sku);
    assert.ok(row, `${identity.sku} missing canonical seed row`);
    assert.ok(identity.sizeValue, `${identity.sku} missing canonical size value`);
    assert.ok(identity.sizeUnit, `${identity.sku} missing canonical size unit`);
    assert.equal(unquote(row[8]), identity.brand);
    assert.equal(unquote(row[9]), identity.variant);

    const seedSizeValue = unquote(row[10]);
    const seedSizeUnit = unquote(row[11]);
    assert.equal(Boolean(seedSizeValue), Boolean(seedSizeUnit));
    if (seedSizeValue !== null) {
      assert.equal(seedSizeValue, identity.sizeValue);
      assert.equal(seedSizeUnit, identity.sizeUnit);
    }
  }
});

test("CSV/XLSX and ZIP package import expose structured product identity", async () => {
  const [importSource, packageDialog, catalogApi] = await Promise.all([
    readFile(new URL("backend/src/services/productImportService.ts", ROOT), "utf8"),
    readFile(
      new URL("frontend/src/components/catalog/ProductPackageImportDialog.tsx", ROOT),
      "utf8"
    ),
    readFile(new URL("frontend/src/services/catalogApi.ts", ROOT), "utf8")
  ]);

  for (const field of ["brand", "variant", "sizeValue", "sizeUnit"]) {
    assert.match(importSource, new RegExp(`"${field}"`));
    assert.match(catalogApi, new RegExp(`${field}: `));
  }
  assert.match(importSource, /brand: row\.brand/);
  assert.match(importSource, /variant: row\.variant/);
  assert.match(importSource, /sizeValue: row\.sizeValue/);
  assert.match(importSource, /sizeUnit: row\.sizeUnit/);
  assert.match(packageDialog, /Variant-ready/);
  assert.match(packageDialog, /Identity review/);
  assert.match(packageDialog, /brand, variant,/);
});

test("owner product table makes identity readiness visible", async () => {
  const ownerPage = await readFile(
    new URL("frontend/src/pages/ProductsPageLegacy.tsx", ROOT),
    "utf8"
  );

  assert.match(ownerPage, /Variant ready/);
  assert.match(ownerPage, /Identity incomplete/);
  assert.match(ownerPage, /productIdentitySummary/);
  assert.match(ownerPage, /Brand, variant, and package size need catalog review/);
});
