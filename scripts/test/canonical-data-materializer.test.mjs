import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanonicalSubset,
  decodeSqlValue,
  normalizeCanonicalDbValue
} from "../canonical-data-materializer.mjs";

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

test("canonical SQL decoder restores MySQL-escaped JSON text", () => {
  const encoded =
    '\'{\\"source\\": {\\"dataset\\": \\"historical-sales\\", \\"productId\\": \\"P317\\"}}\'';
  const decoded = decodeSqlValue(encoded);

  assert.equal(decoded, '{"source": {"dataset": "historical-sales", "productId": "P317"}}');
  assert.deepEqual(JSON.parse(decoded), {
    source: { dataset: "historical-sales", productId: "P317" }
  });
});

test("canonical decimal drift comparison ignores MySQL scale formatting", () => {
  assert.equal(
    normalizeCanonicalDbValue("products", "size_value", "13.5"),
    normalizeCanonicalDbValue("products", "size_value", "13.500")
  );
  assert.equal(
    normalizeCanonicalDbValue("products", "size_value", "180"),
    normalizeCanonicalDbValue("products", "size_value", "180.000")
  );
  assert.notEqual(
    normalizeCanonicalDbValue("products", "description", "13.5"),
    normalizeCanonicalDbValue("products", "description", "13.500")
  );
});

test("canonical JSON drift comparison ignores storage formatting", () => {
  const compact =
    '{"source":{"dataset":"historical-sales","workbooks":["a.xlsx","b.xlsx"]},"identityBasis":["SKU"]}';
  const mysqlFormatted =
    '{"identityBasis": ["SKU"], "source": {"workbooks": ["a.xlsx", "b.xlsx"], "dataset": "historical-sales"}}';

  assert.equal(
    normalizeCanonicalDbValue("sarima_source_product_mappings", "evidence", compact),
    normalizeCanonicalDbValue("sarima_source_product_mappings", "evidence", mysqlFormatted)
  );
  assert.notEqual(
    normalizeCanonicalDbValue("products", "description", compact),
    normalizeCanonicalDbValue("products", "description", mysqlFormatted)
  );
});

// prettier-ignore
test("canonical subset remaps release products onto the public storefront taxonomy", () => {
  const sourceCategory = "Baking / Spreads & Dessert Ingredients";
  const productIds = Array.from({ length: 50 }, (_, index) => "product-" + index);
  const candidateIds = Array.from({ length: 50 }, (_, index) => "candidate-" + index);
  const release = {
    releaseId: "taxonomy-release",
    products: productIds.map((productId, index) => {
      const sourceProductId = "P" + String(index).padStart(3, "0");
      return {
        productId,
        sourceProductId,
        sku: "SARIMA-" + sourceProductId,
        name: "Product " + index,
        manufacturerBarcode: "481000000" + String(index).padStart(4, "0"),
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
  const categorySql =
    "INSERT INTO `categories` " +
    "(`id`,`name`,`slug`,`is_active`,`data_quality_status`,`is_storefront_visible`) " +
    "VALUES ('legacy-baking','" +
    sourceCategory +
    "','baking-spreads-dessert-ingredients','1','NEEDS_REVIEW','0');";
  const productSql =
    "INSERT INTO `products` (" +
    productColumns.map((column) => "`" + column + "`").join(",") +
    ") VALUES " +
    productIds
      .map((id, index) =>
        tuple([
          id,
          "legacy-baking",
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
      .join(",") +
    ";";
  const assetSql =
    "INSERT INTO `product_image_assets` (`id`,`product_id`,`quality_status`) VALUES " +
    candidateIds.map((id, index) => tuple([id, productIds[index], "APPROVED"])).join(",") +
    ";";
  const aliasSql =
    "INSERT INTO `product_aliases` (`id`,`canonical_product_id`,`value`) " +
    "VALUES ('alias','product-0','Alias');";
  const mappingSql =
    "INSERT INTO `sarima_source_product_mappings` " +
    "(`id`,`canonical_product_id`,`source_product_id`,`source_category`) VALUES " +
    productIds
      .map((id, index) =>
        tuple([
          "mapping-" + index,
          id,
          "P" + String(index).padStart(3, "0"),
          sourceCategory
        ])
      )
      .join(",") +
    ";";
  const catalogSql = [categorySql, productSql, assetSql, aliasSql, mappingSql].join("\n");

  const subset = buildCanonicalSubset({ catalogSql, release, reconciliation });
  const category = subset.rows.categories.find((row) => row.id === "legacy-baking");

  assert.equal(category?.name, "Baking & Dessert");
  assert.equal(category?.slug, "baking-dessert");
  assert.equal(category?.data_quality_status, "APPROVED");
  assert.equal(category?.is_storefront_visible, "1");
  assert.equal(
    subset.rows.products.filter((product) => product.category_id === "legacy-baking").length,
    50
  );
});
