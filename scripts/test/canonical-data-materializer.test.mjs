import assert from "node:assert/strict";
import test from "node:test";

import { buildCanonicalSubset } from "../canonical-data-materializer.mjs";

const q = (value) => (value === null ? "NULL" : "'" + value + "'");
const tuple = (values) => "(" + values.map(q).join(",") + ")";

test("canonical subset excludes unrelated catalog rows", () => {
  const productIds = Array.from({ length: 50 }, (_, index) => "product-" + index);
  const candidateIds = Array.from({ length: 50 }, (_, index) => "candidate-" + index);
  const release = {
    releaseId: "test-release",
    products: productIds.map((productId, index) => {
      const sourceProductId = "P" + String(index).padStart(3, "0");
      return {
        productId,
        sourceProductId,
        sku: "SARIMA-" + sourceProductId,
        name: "Product " + index,
        manufacturerBarcode: "480000000" + String(index).padStart(4, "0"),
        description: "Canonical product description " + index,
        brand: "Brand " + index,
        variant: "Variant " + index,
        sizeValue: String(index + 1),
        sizeUnit: "PIECE",
        catalogImage: {
          activeImageAssetId: candidateIds[index],
          legacyImageUrl: "/api/storefront/product-images/" + candidateIds[index] + "/card"
        }
      };
    })
  };
  const reconciliation = {
    items: candidateIds.map((candidateId, index) => ({
      candidateId,
      sourceProductId: "P" + String(index).padStart(3, "0")
    }))
  };
  const productColumns = [
    "id",
    "category_id",
    "active_image_asset_id",
    "sku",
    "barcode",
    "name",
    "description",
    "image_url",
    "brand",
    "variant",
    "size_value",
    "size_unit",
    "status",
    "data_quality_status",
    "is_storefront_visible"
  ];
  const sql = [
    "INSERT INTO `categories` (`id`,`name`,`is_active`,`data_quality_status`,`is_storefront_visible`) VALUES ('cat','Canonical','1','NEEDS_REVIEW','0'),('other','Other','1','NEEDS_REVIEW','0');",
    "INSERT INTO `products` (" +
      productColumns.map((column) => "`" + column + "`").join(",") +
      ") VALUES " +
      productIds
        .map((id, index) =>
          tuple([
            id,
            "cat",
            candidateIds[index],
            "OLD-" + index,
            null,
            "Old Name",
            null,
            "/old",
            null,
            null,
            null,
            null,
            "INACTIVE",
            "NEEDS_REVIEW",
            "0"
          ])
        )
        .concat([
          tuple([
            "unrelated",
            "other",
            null,
            "OTHER",
            null,
            "Other",
            null,
            null,
            null,
            null,
            null,
            null,
            "INACTIVE",
            "NEEDS_REVIEW",
            "0"
          ])
        ])
        .join(",") +
      ";",
    "INSERT INTO `product_image_assets` (`id`,`product_id`,`quality_status`) VALUES " +
      candidateIds
        .map((id, index) => tuple([id, productIds[index], "APPROVED"]))
        .concat([tuple(["unrelated-asset", "unrelated", "APPROVED"])])
        .join(",") +
      ";",
    "INSERT INTO `product_aliases` (`id`,`canonical_product_id`,`value`) VALUES ('alias','product-0','Alias'),('other-alias','unrelated','Other');",
    "INSERT INTO `sarima_source_product_mappings` (`id`,`canonical_product_id`,`source_product_id`) VALUES " +
      productIds
        .map((id, index) => tuple(["mapping-" + index, id, "P" + String(index).padStart(3, "0")]))
        .join(",") +
      ";"
  ].join("\n");

  const subset = buildCanonicalSubset({ catalogSql: sql, release, reconciliation });

  assert.deepEqual(subset.counts, {
    categories: 1,
    products: 50,
    product_image_assets: 50,
    product_aliases: 1,
    sarima_source_product_mappings: 50,
    product_barcodes: 50
  });
  assert.equal(
    subset.rows.products.some((product) => product.id === "unrelated"),
    false
  );
  assert.equal(
    subset.rows.product_barcodes.every((barcode) => barcode.type === "MANUFACTURER"),
    true
  );
  assert.equal(
    subset.statements
      .slice(0, 5)
      .every((statement) => statement.includes("ON DUPLICATE KEY UPDATE")),
    true
  );
  const barcodeInsert = subset.statements.at(-1);
  assert.match(barcodeInsert, /INSERT INTO product_barcodes/);
  assert.match(barcodeInsert, /created_at,updated_at/);
  assert.match(barcodeInsert, /CURRENT_TIMESTAMP\(3\),CURRENT_TIMESTAMP\(3\)/);
});
