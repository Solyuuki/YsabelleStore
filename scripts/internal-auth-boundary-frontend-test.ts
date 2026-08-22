import assert from "node:assert/strict";

import { shouldAttachInternalBearer } from "../frontend/src/utils/internalAuthRoutes.ts";

const apiBase = "http://localhost:4000";

const customerPaths = [
  "/api/storefront/products",
  "/api/storefront/orders",
  "/api/customer-auth/me",
  "/api/customer-auth/login",
  "/api/customer-account/orders"
];

for (const path of customerPaths) {
  assert.equal(
    shouldAttachInternalBearer(new URL(path, apiBase)),
    false,
    `internal bearer must not be attached to ${path}`
  );
}

const internalPaths = ["/api/auth/me", "/api/inventory", "/api/products"];

for (const path of internalPaths) {
  assert.equal(
    shouldAttachInternalBearer(new URL(path, apiBase)),
    true,
    `internal bearer should remain available for ${path}`
  );
}

console.log("Internal auth frontend boundary contract passed.");
