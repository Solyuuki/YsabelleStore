export const STOREFRONT_RECENT_SEARCHES_KEY = "ysabelle:storefront:recent-searches";
export const STOREFRONT_RECENT_SEARCHES_LIMIT = 5;
export const STOREFRONT_SEARCH_QUERY_MAX_LENGTH = 120;

type SearchHistoryStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function getStorage(): SearchHistoryStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeStorefrontSearchQuery(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, STOREFRONT_SEARCH_QUERY_MAX_LENGTH);
}

export function readRecentStorefrontSearches(storage: SearchHistoryStorage | null = getStorage()) {
  if (!storage) return [];

  try {
    const rawValue = storage.getItem(STOREFRONT_RECENT_SEARCHES_KEY);
    if (!rawValue) return [];

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];

    return normalizeRecentSearches(parsedValue);
  } catch {
    return [];
  }
}

export function recordRecentStorefrontSearch(
  query: string,
  storage: SearchHistoryStorage | null = getStorage()
) {
  const normalizedQuery = normalizeStorefrontSearchQuery(query);
  const currentSearches = readRecentStorefrontSearches(storage);
  if (!normalizedQuery) return currentSearches;

  const nextSearches = normalizeRecentSearches([
    normalizedQuery,
    ...currentSearches.filter((entry) => !isSameSearch(entry, normalizedQuery))
  ]);
  writeRecentStorefrontSearches(nextSearches, storage);
  return nextSearches;
}

export function removeRecentStorefrontSearch(
  query: string,
  storage: SearchHistoryStorage | null = getStorage()
) {
  const normalizedQuery = normalizeStorefrontSearchQuery(query);
  const nextSearches = readRecentStorefrontSearches(storage).filter(
    (entry) => !isSameSearch(entry, normalizedQuery)
  );
  writeRecentStorefrontSearches(nextSearches, storage);
  return nextSearches;
}

export function clearRecentStorefrontSearches(storage: SearchHistoryStorage | null = getStorage()) {
  if (!storage) return;

  try {
    storage.removeItem(STOREFRONT_RECENT_SEARCHES_KEY);
  } catch {
    // Private browsing and enterprise browser policies can deny storage access.
  }
}

function normalizeRecentSearches(values: unknown[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const query = normalizeStorefrontSearchQuery(value);
    const key = getSearchKey(query);
    if (!query || seen.has(key)) continue;

    seen.add(key);
    normalized.push(query);
    if (normalized.length === STOREFRONT_RECENT_SEARCHES_LIMIT) break;
  }

  return normalized;
}

function writeRecentStorefrontSearches(searches: string[], storage: SearchHistoryStorage | null) {
  if (!storage) return;

  try {
    if (searches.length === 0) {
      storage.removeItem(STOREFRONT_RECENT_SEARCHES_KEY);
      return;
    }
    storage.setItem(STOREFRONT_RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch {
    // Search remains usable when local storage is unavailable or full.
  }
}

function isSameSearch(left: string, right: string) {
  return getSearchKey(left) === getSearchKey(right);
}

function getSearchKey(value: string) {
  return value.toLowerCase();
}
