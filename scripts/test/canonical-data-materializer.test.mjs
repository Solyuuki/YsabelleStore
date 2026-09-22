import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalSubset } from "../canonical-data-materializer.mjs";
const q = (v) => (v === null ? "NULL" : "'" + v + "'"),
  tuple = (a) => "(" + a.map(q).join(",") + ")";
test("canonical subset excludes unrelated catalog rows", () => {
  const p = Array.from({ length: 50 }, (_, i) => "product-" + i),
    c = Array.from({ length: 50 }, (_, i) => "candidate-" + i),
    release = {
      products: p.map((productId, i) => ({
        productId,
        sourceProductId: "P" + String(i).padStart(3, "0")
      }))
    },
    reconciliation = {
      items: c.map((candidateId, i) => ({
        candidateId,
        sourceProductId: "P" + String(i).padStart(3, "0")
      }))
    };
  const sql = [
    "INSERT INTO `categories` (`id`,`name`) VALUES ('cat','Canonical'),('other','Other');",
    "INSERT INTO `products` (`id`,`category_id`,`name`) VALUES " +
      p
        .map((id) => tuple([id, "cat", "Name"]))
        .concat([tuple(["unrelated", "other", "Other"])])
        .join(",") +
      ";",
    "INSERT INTO `product_image_assets` (`id`,`product_id`,`quality_status`) VALUES " +
      c
        .map((id, i) => tuple([id, p[i], "APPROVED"]))
        .concat([tuple(["unrelated-asset", "unrelated", "APPROVED"])])
        .join(",") +
      ";",
    "INSERT INTO `product_aliases` (`id`,`canonical_product_id`,`value`) VALUES ('alias','product-0','Alias'),('other-alias','unrelated','Other');",
    "INSERT INTO `sarima_source_product_mappings` (`id`,`canonical_product_id`,`source_product_id`) VALUES " +
      p.map((id, i) => tuple(["mapping-" + i, id, "P" + String(i).padStart(3, "0")])).join(",") +
      ";"
  ].join("\n");
  const s = buildCanonicalSubset({ catalogSql: sql, release, reconciliation });
  assert.deepEqual(s.counts, {
    categories: 1,
    products: 50,
    product_image_assets: 50,
    product_aliases: 1,
    sarima_source_product_mappings: 50
  });
  assert.ok(s.statements.every((x) => x.includes("ON DUPLICATE KEY UPDATE")));
});
