import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  classifyRuntimeImageOverride,
  isProtectedImageColumn,
  isRuntimeImageAssetId
} from "../canonical-runtime-image-overrides.mjs";

const id = "29cd1240-46d0-4b3e-9ed2-287a53d89b15";

test("canonical IDs stay canonical; real owner upload UUIDs are runtime-owned", () => {
  assert.equal(isRuntimeImageAssetId("sarima-p048-2933697c7efd"), false);
  assert.equal(isRuntimeImageAssetId(id), true);
});

test("image protection requires approved READY asset and every storage file", () => {
  const root = mkdtempSync(join(tmpdir(), "ysabelle-image-protection-"));
  const keys = ["original.jpg", "processed.webp", "card.webp", "pdp.webp"];
  const storage = Object.fromEntries(
    keys.map((name) => [name, `candidates/${id}/${name}`])
  );
  const row = {
    id: "product-happy-cotton",
    active_image_asset_id: id,
    image_url: `/api/storefront/product-images/${id}/card`,
    asset_product_id: "product-happy-cotton",
    quality_status: "APPROVED",
    processing_status: "READY",
    approved_at: new Date(),
    superseded_at: null,
    original_storage_key: storage["original.jpg"],
    processed_storage_key: storage["processed.webp"],
    card_storage_key: storage["card.webp"],
    pdp_storage_key: storage["pdp.webp"]
  };
  try {
    mkdirSync(join(root, "candidates", id), { recursive: true });
    for (const name of keys) writeFileSync(join(root, storage[name]), "test bytes");
    assert.deepEqual(classifyRuntimeImageOverride(row, root), {
      productId: row.id,
      imageId: id,
      imageUrl: row.image_url
    });
    assert.equal(isProtectedImageColumn("products", "image_url", row.id, new Map([[row.id, true]])), true);
    assert.equal(isProtectedImageColumn("products", "name", row.id, new Map([[row.id, true]])), false);
    assert.throws(() => classifyRuntimeImageOverride({ ...row, quality_status: "REJECTED" }, root));
    assert.throws(() => classifyRuntimeImageOverride({ ...row, pdp_storage_key: "../../escape" }, root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
