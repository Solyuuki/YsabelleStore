import assert from "node:assert/strict";
import test from "node:test";

import { inspectReleaseContract } from "../canonical-release-security.mjs";

const state = {
  releaseId: "g2-s2-c2-a2",
  migrationEpoch: 2,
  catalogVersion: 2,
  assetVersion: 2,
  canonicalProductImageRoot: "images"
};

function product(index) {
  const code = `P${String(index).padStart(3, "0")}`;
  return {
    sourceProductId: code,
    productId: `product-${code}`,
    sku: `SARIMA-${code}`,
    name: `Product ${code}`,
    manufacturerBarcode: `4800000000${String(index).padStart(3, "0")}`,
    description: "Approved product description.",
    sourceImage: {
      driveFileId: `drive-${code}`,
      path: `images/${code}.jpg`,
      gitBlobOid: "not-used-in-structure-only-tests",
      sizeBytes: 1
    },
    catalogImage: {
      activeImageAssetId: null,
      qualityStatus: null,
      processingStatus: null,
      legacyImageUrl: `/presentation-catalog-images/${code}.webp`
    }
  };
}

function release() {
  return {
    formatVersion: 1,
    releaseId: state.releaseId,
    migrationEpoch: 2,
    catalogVersion: 2,
    assetVersion: 2,
    canonicalScope: "PRODUCTION_VERIFIED_50",
    expectedProducts: 50,
    canonicalTables: ["categories", "products", "product_image_assets"],
    excludedRuntimeTables: [
      "users",
      "trusted_devices",
      "customer_accounts",
      "customer_sessions",
      "customer_cart_items",
      "customer_orders",
      "customer_order_items",
      "sales",
      "sale_items",
      "inventory",
      "inventory_batches",
      "inventory_movements"
    ],
    inventoryPolicy: "PRESERVE_RUNTIME_STATE",
    productImagePolicy: "GIT_PINNED_SOURCE_BYTES",
    products: Array.from({ length: 50 }, (_, index) => product(index + 1))
  };
}

test("canonical release rejects duplicate product identities", () => {
  const candidate = release();
  candidate.products[1].sku = candidate.products[0].sku;
  const findings = inspectReleaseContract({ state, release: candidate, root: "." });
  assert.ok(findings.some((item) => item.includes("duplicate canonical SKU")));
});

test("canonical release keeps runtime inventory and customer data excluded", () => {
  const candidate = release();
  candidate.excludedRuntimeTables = candidate.excludedRuntimeTables.filter(
    (table) => table !== "inventory"
  );
  const findings = inspectReleaseContract({ state, release: candidate, root: "." });
  assert.ok(findings.some((item) => item.includes("inventory")));
});

test("canonical release requires exactly 50 products", () => {
  const candidate = release();
  candidate.products.pop();
  const findings = inspectReleaseContract({ state, release: candidate, root: "." });
  assert.ok(findings.some((item) => item.includes("exactly 50")));
});
