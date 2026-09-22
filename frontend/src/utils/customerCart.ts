import type { StorefrontProduct } from "@/types/storefront";

export type PersistedCartItem = {
  product: StorefrontProduct;
  quantity: number;
};

export const GUEST_CART_STORAGE_KEY = "ysabelle:guest-cart:v1";
export const LEGACY_CART_STORAGE_KEY = "ysabelle:customer-cart:v1";

export function normalizeCartItems(items: PersistedCartItem[]): PersistedCartItem[] {
  return items
    .filter(
      (item) =>
        item?.product?.id &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.product.availableStock > 0
    )
    .map((item) => ({
      product: item.product,
      quantity: Math.min(item.quantity, item.product.availableStock)
    }));
}

export function mergeCartItems(
  accountItems: PersistedCartItem[],
  guestItems: PersistedCartItem[]
): PersistedCartItem[] {
  const merged = new Map<string, PersistedCartItem>();

  for (const item of [...accountItems, ...guestItems]) {
    const existing = merged.get(item.product.id);
    const product = item.product;
    const quantity = Math.min(
      (existing?.quantity ?? 0) + item.quantity,
      product.availableStock
    );
    if (quantity > 0) merged.set(product.id, { product, quantity });
  }

  return [...merged.values()];
}

export function readGuestCart(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">): PersistedCartItem[] {
  try {
    const guestRaw = storage.getItem(GUEST_CART_STORAGE_KEY);
    const legacyRaw = storage.getItem(LEGACY_CART_STORAGE_KEY);
    const raw = guestRaw ?? legacyRaw ?? "[]";
    const parsed = JSON.parse(raw) as PersistedCartItem[];
    const normalized = Array.isArray(parsed) ? normalizeCartItems(parsed) : [];

    if (guestRaw === null && legacyRaw !== null) {
      storage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(normalized));
      storage.removeItem(LEGACY_CART_STORAGE_KEY);
    }

    return normalized;
  } catch {
    return [];
  }
}

export function writeGuestCart(
  storage: Pick<Storage, "setItem" | "removeItem">,
  items: PersistedCartItem[]
) {
  storage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(normalizeCartItems(items)));
  storage.removeItem(LEGACY_CART_STORAGE_KEY);
}

export function clearGuestCart(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(GUEST_CART_STORAGE_KEY);
  storage.removeItem(LEGACY_CART_STORAGE_KEY);
}
