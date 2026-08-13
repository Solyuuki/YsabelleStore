import assert from "node:assert/strict";

import {
  clearRecentStorefrontSearches,
  normalizeStorefrontSearchQuery,
  readRecentStorefrontSearches,
  recordRecentStorefrontSearch,
  removeRecentStorefrontSearch,
  STOREFRONT_RECENT_SEARCHES_KEY,
  STOREFRONT_RECENT_SEARCHES_LIMIT,
  STOREFRONT_SEARCH_QUERY_MAX_LENGTH
} from "../frontend/src/utils/storefrontSearchHistory";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const storage = new MemoryStorage();

assert.equal(normalizeStorefrontSearchQuery("  beef\n  noodles  "), "beef noodles");
assert.equal(
  normalizeStorefrontSearchQuery("a".repeat(STOREFRONT_SEARCH_QUERY_MAX_LENGTH + 10)).length,
  STOREFRONT_SEARCH_QUERY_MAX_LENGTH
);

storage.setItem(
  STOREFRONT_RECENT_SEARCHES_KEY,
  JSON.stringify(["  Rice ", "rice", 42, "Instant   Noodles", "", "Sardines"])
);
assert.deepEqual(readRecentStorefrontSearches(storage), ["Rice", "Instant Noodles", "Sardines"]);

assert.deepEqual(recordRecentStorefrontSearch(" INSTANT noodles ", storage), [
  "INSTANT noodles",
  "Rice",
  "Sardines"
]);

for (const query of ["Bread", "Milk", "Cooking Oil", "Coffee"]) {
  recordRecentStorefrontSearch(query, storage);
}
const cappedSearches = readRecentStorefrontSearches(storage);
assert.equal(cappedSearches.length, STOREFRONT_RECENT_SEARCHES_LIMIT);
assert.deepEqual(cappedSearches, ["Coffee", "Cooking Oil", "Milk", "Bread", "INSTANT noodles"]);

assert.deepEqual(removeRecentStorefrontSearch("MILK", storage), [
  "Coffee",
  "Cooking Oil",
  "Bread",
  "INSTANT noodles"
]);

clearRecentStorefrontSearches(storage);
assert.deepEqual(readRecentStorefrontSearches(storage), []);

storage.setItem(STOREFRONT_RECENT_SEARCHES_KEY, "not valid JSON");
assert.deepEqual(readRecentStorefrontSearches(storage), []);
