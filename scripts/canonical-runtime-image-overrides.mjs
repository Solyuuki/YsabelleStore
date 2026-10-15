import { existsSync, statSync } from "node:fs";
import { relative, resolve, isAbsolute } from "node:path";

import { resolveRuntimeRoot } from "./canonical-asset-materializer.mjs";

const RUNTIME_ASSET_ID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const IMAGE_FIELDS = ["active_image_asset_id", "image_url"];

export function isRuntimeImageAssetId(id) {
  return typeof id === "string" && RUNTIME_ASSET_ID.test(id);
}

export function validateRuntimeImageFiles(asset, root = resolveRuntimeRoot()) {
  const keys = [
    asset.original_storage_key,
    asset.processed_storage_key,
    asset.card_storage_key,
    asset.pdp_storage_key
  ];
  for (const key of keys) {
    if (!key || isAbsolute(key) || key.includes("\\") || !key.startsWith("candidates/")) {
      throw new Error("Runtime image has an unsafe or missing storage key: " + asset.id);
    }
    const absolute = resolve(root, key);
    const rel = relative(resolve(root), absolute);
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || !existsSync(absolute)) {
      throw new Error("Approved runtime image file missing: " + asset.id + " (" + key + ")");
    }
    if (!statSync(absolute).isFile()) {
      throw new Error("Approved runtime image key is not a file: " + asset.id);
    }
  }
}

export function classifyRuntimeImageOverride(row, root = resolveRuntimeRoot()) {
  const id = row.active_image_asset_id;
  if (!isRuntimeImageAssetId(id)) return null;
  const expectedUrl = `/api/storefront/product-images/${id}/card`;
  if (
    row.asset_product_id !== row.id ||
    row.image_url !== expectedUrl ||
    row.quality_status !== "APPROVED" ||
    row.processing_status !== "READY" ||
    !row.approved_at ||
    row.superseded_at
  ) {
    throw new Error("Runtime image approval is inconsistent for product " + row.id);
  }
  validateRuntimeImageFiles(row, root);
  return { productId: row.id, imageId: id, imageUrl: expectedUrl };
}

export async function collectRuntimeImageOverrides(prisma, subset, root = resolveRuntimeRoot()) {
  const products = subset.rows.products ?? [];
  if (!products.length) return new Map();
  const ids = products.map((product) => String(product.id));
  const rows = await prisma.$queryRawUnsafe(
    "SELECT p.id,p.active_image_asset_id,p.image_url," +
      "a.product_id AS asset_product_id,a.quality_status,a.processing_status," +
      "a.approved_at,a.superseded_at,a.original_storage_key,a.processed_storage_key," +
      "a.card_storage_key,a.pdp_storage_key " +
      "FROM products p LEFT JOIN product_image_assets a ON a.id=p.active_image_asset_id " +
      "WHERE p.id IN (" +
      ids.map(() => "?").join(",") +
      ")",
    ...ids
  );
  const expected = new Map(products.map((product) => [String(product.id), product]));
  const overrides = new Map();
  for (const row of rows) {
    const baseline = expected.get(String(row.id));
    if (!baseline || row.active_image_asset_id === baseline.active_image_asset_id) continue;
    const override = classifyRuntimeImageOverride(row, root);
    if (override) overrides.set(String(row.id), override);
  }
  return overrides;
}

export async function collectOwnerEditedProductIds(prisma, subset) {
  const products = subset.rows.products ?? [];
  if (!products.length) return new Set();
  const ids = products.map((product) => String(product.id));
  const rows = await prisma.$queryRawUnsafe(
    "SELECT DISTINCT canonical_product_id AS id FROM catalog_audit_logs " +
      "WHERE action='MANUAL_PRODUCT_UPDATE' AND automated=0 " +
      "AND canonical_product_id IN (" +
      ids.map(() => "?").join(",") +
      ")",
    ...ids
  );
  return new Set(rows.map((row) => String(row.id)));
}

export function isProtectedImageColumn(table, column, productId, overrides) {
  return table === "products" && IMAGE_FIELDS.includes(column) && overrides.has(String(productId));
}
