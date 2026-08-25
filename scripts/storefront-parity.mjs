import assert from "node:assert/strict";

import { resolveDevelopmentRuntime } from "./lib/runtime-config.mjs";

const runtime = resolveDevelopmentRuntime();
const apiBaseUrl = new URL(runtime.apiBaseUrl);
const frontendUrl = new URL(runtime.frontendUrl);
const electronRendererUrl = new URL(runtime.electronRendererUrl);
const clients = [
  { label: "browser", origin: frontendUrl.origin },
  { label: "electron-dev", origin: electronRendererUrl.origin },
  { label: "electron-packaged", origin: "null" },
  { label: "browser-127", origin: "http://127.0.0.1:5173" }
];

const snapshots = await Promise.all(clients.map(readStorefront));
const baseline = snapshots[0];

assert.ok(baseline, "The browser storefront snapshot was not created.");

for (const snapshot of snapshots.slice(1)) {
  assert.deepEqual(
    snapshot.data,
    baseline.data,
    `${snapshot.label} did not receive the browser storefront payload.`
  );
}

console.log(`Storefront parity passed against ${apiBaseUrl.origin}.`);
console.log(
  `Compared clients: ${snapshots.map((snapshot) => `${snapshot.label} (${snapshot.origin})`).join(", ")}`
);
console.log(
  `Counts: products=${baseline.data.productCount}; categories=${baseline.data.categoryCount}`
);
console.log("Sample products:");
for (const product of baseline.data.products) {
  console.log(
    `- ${product.id} | ${product.name} | price=${product.price} | stock=${product.stock} | imageUrl=${product.imageUrl ?? "null"} | category=${product.category.name}`
  );
}

async function readStorefront(client) {
  const [productsPayload, categoriesPayload] = await Promise.all([
    getJson("/api/storefront/products?page=1&pageSize=10", client),
    getJson("/api/storefront/categories", client)
  ]);

  assert.ok(
    Array.isArray(productsPayload.body.data),
    `${client.label} products were not an array.`
  );
  assert.ok(
    Array.isArray(categoriesPayload.body.data),
    `${client.label} categories were not an array.`
  );

  return {
    label: client.label,
    origin: client.origin,
    data: {
      productCount: productsPayload.body.meta?.totalItems ?? productsPayload.body.data.length,
      categoryCount: categoriesPayload.body.data.length,
      products: productsPayload.body.data.slice(0, 5).map((product) => ({
        id: product.id,
        name: product.name,
        price: product.sellingPrice,
        stock: product.availableStock,
        imageUrl: product.imageUrl ?? null,
        category: {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug
        }
      }))
    }
  };
}

async function getJson(path, client) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    headers: { Origin: client.origin },
    signal: AbortSignal.timeout(10_000)
  });
  const allowedOrigin = response.headers.get("access-control-allow-origin");

  assert.equal(
    allowedOrigin,
    client.origin,
    `${client.label} origin ${client.origin} was not allowed by CORS.`
  );
  assert.ok(response.ok, `${client.label} request to ${path} returned ${response.status}.`);

  const body = await response.json();
  assert.equal(body.success, true, `${client.label} request to ${path} was not successful.`);

  return { body };
}
