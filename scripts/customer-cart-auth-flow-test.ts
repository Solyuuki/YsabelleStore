import assert from "node:assert/strict";

import {
  buildCustomerAuthPath,
  getCustomerReturnPath,
  isCustomerProtectedRoute,
  resolveCustomerAuthRedirect
} from "../frontend/src/utils/customerRoutes.ts";
import {
  GUEST_CART_STORAGE_KEY,
  LEGACY_CART_STORAGE_KEY,
  mergeCartItems,
  readGuestCart
} from "../frontend/src/utils/customerCart.ts";
import type { StorefrontProduct } from "../frontend/src/types/storefront.ts";

function product(id: string, availableStock = 10): StorefrontProduct {
  return {
    id,
    name: `Product ${id}`,
    description: null,
    imageUrl: null,
    unit: "PIECE",
    sellingPrice: "10.00",
    availableStock,
    stockStatus: "IN_STOCK",
    averageRating: 0,
    reviewCount: 0,
    category: { id: "category", name: "Pantry", slug: "pantry" }
  };
}

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

assert.equal(isCustomerProtectedRoute("/checkout"), true);
assert.equal(isCustomerProtectedRoute("/account"), true);
assert.equal(isCustomerProtectedRoute("/cart"), false);

assert.equal(
  resolveCustomerAuthRedirect("/checkout", "unauthenticated"),
  "/login?returnTo=%2Fcheckout"
);
assert.equal(
  resolveCustomerAuthRedirect("/login", "authenticated", "?returnTo=%2Fcheckout"),
  "/checkout"
);
assert.equal(getCustomerReturnPath("?returnTo=https%3A%2F%2Fevil.example"), null);
assert.equal(getCustomerReturnPath("?returnTo=%2F%2Fevil.example"), null);
assert.equal(buildCustomerAuthPath("/register", "/checkout"), "/register?returnTo=%2Fcheckout");

const red = product("red", 4);
const green = product("green", 3);
const merged = mergeCartItems(
  [{ product: red, quantity: 2 }],
  [
    { product: red, quantity: 3 },
    { product: green, quantity: 1 }
  ]
);
assert.equal(merged.find((item) => item.product.id === "red")?.quantity, 4);
assert.equal(merged.find((item) => item.product.id === "green")?.quantity, 1);

const storage = new MemoryStorage();
storage.setItem(LEGACY_CART_STORAGE_KEY, JSON.stringify([{ product: green, quantity: 2 }]));
const migrated = readGuestCart(storage);
assert.equal(migrated[0]?.product.id, "green");
assert.equal(migrated[0]?.quantity, 2);
assert.equal(storage.getItem(LEGACY_CART_STORAGE_KEY), null);
assert.ok(storage.getItem(GUEST_CART_STORAGE_KEY));

console.log("Customer guest-to-account cart and checkout auth contract passed.");
