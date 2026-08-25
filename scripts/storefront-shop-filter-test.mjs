import assert from "node:assert/strict";

const apiOrigin = process.env.STOREFRONT_API_ORIGIN ?? "http://localhost:3001";
const hiddenClassicColaId = "prd_cola_15l";
const imageReadyLigoId = "prd_sarima_p144_ligo_sardines_155g";

async function listProducts(query) {
  const response = await fetch(
    `${apiOrigin}/api/storefront/products?${new URLSearchParams(query)}`
  );
  assert.equal(response.ok, true, `Storefront products request failed with ${response.status}.`);

  const payload = await response.json();
  return { items: payload.data, meta: payload.meta };
}

function includesProduct(result, productId) {
  return result.items.some((product) => product.id === productId);
}

const baseQuery = { availability: "all", page: "1", pageSize: "24" };
const completeCatalog = await listProducts(baseQuery);
const hiddenByName = await listProducts({ ...baseQuery, search: "cola" });
const hiddenBySku = await listProducts({ ...baseQuery, search: "BEV-COLA-001" });
const hiddenByBarcode = await listProducts({ ...baseQuery, search: "4800012345678" });
const imageReadyByName = await listProducts({ ...baseQuery, search: "Ligo" });
const imageReadyBySku = await listProducts({ ...baseQuery, search: "SARIMA-P144" });
const inStock = await listProducts({ ...baseQuery, availability: "in-stock" });
const outOfStock = await listProducts({
  ...baseQuery,
  availability: "out-of-stock"
});
const hiddenDetailResponse = await fetch(
  `${apiOrigin}/api/storefront/products/${hiddenClassicColaId}`
);

assert.equal(
  includesProduct(hiddenByName, hiddenClassicColaId),
  false,
  "Name search must not expose an image-pending product."
);
assert.equal(
  includesProduct(hiddenBySku, hiddenClassicColaId),
  false,
  "SKU search must not expose an image-pending product."
);
assert.equal(
  includesProduct(hiddenByBarcode, hiddenClassicColaId),
  false,
  "Barcode search must not expose an image-pending product."
);
assert.equal(
  hiddenDetailResponse.status,
  404,
  "Direct customer detail lookup must not expose an image-pending product."
);
assert.equal(
  includesProduct(imageReadyByName, imageReadyLigoId),
  true,
  "Name search must return a matching image-ready product."
);
assert.equal(
  includesProduct(imageReadyBySku, imageReadyLigoId),
  true,
  "SKU search must return a matching image-ready product."
);
assert.equal(
  inStock.items.every((product) => product.availableStock > 0),
  true
);
assert.equal(
  outOfStock.items.every((product) => product.availableStock <= 0),
  true
);
assert.equal(inStock.meta.totalItems + outOfStock.meta.totalItems, completeCatalog.meta.totalItems);
assert.equal(
  completeCatalog.items.every(
    (product) =>
      typeof product.imageUrl === "string" &&
      product.imageUrl.startsWith("/images/products/") &&
      product.imageUrl.endsWith(".webp")
  ),
  true,
  "Every Shop product must use an approved local WebP asset."
);

console.log("Storefront Shop filter behavior passed.");
