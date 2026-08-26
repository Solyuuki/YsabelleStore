import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("product image edit panel falls back to the current published image when CIQE history is orphaned", () => {
  const panel = read("frontend/src/components/catalog/ProductImageUploadPanel.tsx");

  assert.match(panel, /import \{ fetchProductById \} from "@\/services\/catalogApi";/);
  assert.match(panel, /import \{ getCatalogImageUrl \} from "@\/utils\/storefrontImages";/);
  assert.match(panel, /setPublishedPreviewUrl\(getCatalogImageUrl\(product\.imageUrl\)\);/);
  assert.match(panel, /title="Published"/);
  assert.match(panel, /publishedPreviewUrl/);
  assert.match(panel, /Current storefront image/);
});
