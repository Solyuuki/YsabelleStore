import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildCanonicalSubset } from "../canonical-data-materializer.mjs";

const ROOT = new URL("../../", import.meta.url);

test("canonical materialization restores complete production product metadata", async () => {
  const [catalogSql, releaseText, reconciliationText] = await Promise.all([
    readFile(new URL("database/seed/canonical-catalog-v1.sql", ROOT), "utf8"),
    readFile(new URL("database/canonical/releases/g2-s2-c4-a2.json", ROOT), "utf8"),
    readFile(
      new URL("database/canonical/product-images/candidate-reconciliation.json", ROOT),
      "utf8"
    )
  ]);
  const release = JSON.parse(releaseText);
  const reconciliation = JSON.parse(reconciliationText);
  const subset = buildCanonicalSubset({ catalogSql, release, reconciliation });

  assert.equal(subset.rows.products.length, 50);
  assert.equal(subset.rows.product_barcodes.length, 50);
  assert.equal(subset.counts.product_barcodes, 50);

  const productsById = new Map(subset.rows.products.map((product) => [product.id, product]));
  const barcodesByProductId = new Map(
    subset.rows.product_barcodes.map((barcode) => [barcode.product_id, barcode])
  );

  for (const expected of release.products) {
    const actual = productsById.get(expected.productId);
    assert.ok(actual, expected.sourceProductId + " missing materialized product");
    assert.equal(actual.sku, expected.sku);
    assert.equal(actual.name, expected.name);
    assert.equal(actual.description, expected.description);
    assert.equal(actual.barcode, expected.manufacturerBarcode);
    assert.equal(actual.brand, expected.brand);
    assert.equal(actual.variant, expected.variant);
    assert.equal(actual.size_value, expected.sizeValue ?? null);
    assert.equal(actual.size_unit, expected.sizeUnit ?? null);
    assert.equal(actual.status, "ACTIVE");
    assert.equal(actual.data_quality_status, "APPROVED");
    assert.equal(actual.is_storefront_visible, "1");
    assert.equal(actual.active_image_asset_id, expected.catalogImage.activeImageAssetId);
    assert.equal(actual.image_url, expected.catalogImage.legacyImageUrl);

    const barcode = barcodesByProductId.get(expected.productId);
    assert.ok(barcode, expected.sourceProductId + " missing canonical barcode record");
    assert.equal(barcode.barcode, expected.manufacturerBarcode);
    assert.equal(barcode.type, "MANUFACTURER");
    assert.equal(barcode.is_primary, "1");
    assert.equal(barcode.source, "VERIFIED_BOOTSTRAP");
  }

  for (const category of subset.rows.categories) {
    assert.equal(category.is_active, "1");
    assert.equal(category.data_quality_status, "APPROVED");
    assert.equal(category.is_storefront_visible, "1");
  }
});
