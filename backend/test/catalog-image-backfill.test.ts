import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

async function loadBackfillModule() {
  try {
    return await import("../src/modules/catalog-image/legacyImageBackfill.js");
  } catch {
    return null;
  }
}

test("legacy image resolver accepts only an exact local product-image basename", async () => {
  const backfill = await loadBackfillModule();
  assert.equal(
    typeof backfill?.resolveLegacyProductImageSource,
    "function",
    "resolveLegacyProductImageSource must be implemented"
  );

  const repositoryRoot = path.resolve("C:/repo/YsabelleStore");
  const expected = path.join(
    repositoryRoot,
    "frontend",
    "public",
    "images",
    "products",
    "originals",
    "ligo.webp"
  );

  assert.equal(
    backfill.resolveLegacyProductImageSource(repositoryRoot, "/images/products/ligo.webp"),
    expected
  );
});

test("legacy image resolver rejects unsafe, nested, remote, decorated, and CIQE URLs", async () => {
  const backfill = await loadBackfillModule();
  assert.equal(
    typeof backfill?.resolveLegacyProductImageSource,
    "function",
    "resolveLegacyProductImageSource must be implemented"
  );

  const repositoryRoot = path.resolve("C:/repo/YsabelleStore");
  const rejected = [
    null,
    "",
    "/images/products/../secret.webp",
    "/images/products/nested/secret.webp",
    "/images/products/ligo.webp?cache=1",
    "/images/products/ligo.webp#preview",
    "https://example.com/ligo.webp",
    "C:/images/ligo.webp",
    "/api/storefront/product-images/image-1/card"
  ];

  for (const imageUrl of rejected) {
    assert.equal(
      backfill.resolveLegacyProductImageSource(repositoryRoot, imageUrl),
      null,
      `expected unsafe legacy URL to be rejected: ${String(imageUrl)}`
    );
  }
});
