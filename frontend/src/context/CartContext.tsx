import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";

import { useCustomerAuth } from "@/context/CustomerAuthContext";
import {
  clearCustomerCart as clearAccountCart,
  fetchCustomerCart,
  mergeGuestCartIntoAccount,
  removeCustomerCartItem as removeAccountCartItem,
  setCustomerCartItem as setAccountCartItem,
  type CustomerCartEntry
} from "@/services/customerCartService";
import { fetchStorefrontProduct } from "@/services/storefrontService";
import type { StorefrontProduct } from "@/types/storefront";
import {
  clearGuestCart,
  readGuestCart,
  writeGuestCart,
  type PersistedCartItem
} from "@/utils/customerCart";

export type CartItem = PersistedCartItem;

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  announcement: string;
  isReady: boolean;
  addItem: (product: StorefrontProduct, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

async function hydrateCustomerCart(entries: CustomerCartEntry[]): Promise<CartItem[]> {
  const hydrated = await Promise.all(
    entries.map(async (entry) => {
      try {
        const product = await fetchStorefrontProduct(entry.productId);
        if (product.availableStock <= 0) return null;
        return {
          product,
          quantity: Math.min(entry.quantity, product.availableStock)
        } satisfies CartItem;
      } catch {
        return null;
      }
    })
  );

  return hydrated.filter((item): item is CartItem => item !== null);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { customer, status } = useCustomerAuth();
  const customerId = customer?.id ?? null;
  const [items, setItems] = useState<CartItem[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [activeOwner, setActiveOwner] = useState<"loading" | "guest" | string>("loading");
  const syncGeneration = useRef(0);

  const isReady =
    status === "unauthenticated"
      ? activeOwner === "guest"
      : status === "authenticated" && customerId
        ? activeOwner === customerId
        : false;

  useEffect(() => {
    const generation = ++syncGeneration.current;

    if (status === "loading") {
      setActiveOwner("loading");
      return;
    }

    if (!customerId) {
      setItems(readGuestCart(localStorage));
      setActiveOwner("guest");
      return;
    }

    const guestItems = readGuestCart(localStorage);
    setActiveOwner("loading");

    const accountEntries = guestItems.length
      ? mergeGuestCartIntoAccount(
          guestItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity
          }))
        )
      : fetchCustomerCart();

    void accountEntries
      .then(hydrateCustomerCart)
      .then((accountItems) => {
        if (generation !== syncGeneration.current) return;
        clearGuestCart(localStorage);
        setItems(accountItems);
        setActiveOwner(customerId);
        if (guestItems.length) {
          setAnnouncement("Your guest cart was moved into your account.");
        }
      })
      .catch(() => {
        if (generation !== syncGeneration.current) return;
        setItems(guestItems);
        setActiveOwner(customerId);
        setAnnouncement(
          "Your account cart could not be synchronized. Your guest cart is still safe on this device."
        );
      });
  }, [customerId, status]);

  useEffect(() => {
    if (activeOwner === "guest") {
      writeGuestCart(localStorage, items);
    }
  }, [activeOwner, items]);

  const visibleItems = isReady ? items : [];
  const itemCount = visibleItems.reduce((total, item) => total + item.quantity, 0);
  const subtotal = visibleItems.reduce(
    (total, item) => total + Number(item.product.sellingPrice) * item.quantity,
    0
  );
  const isAccountCart = Boolean(customerId && activeOwner === customerId);

  function handleAccountSyncFailure() {
    setAnnouncement("Your cart changed here, but the account copy could not be synchronized.");
  }

  function addItem(product: StorefrontProduct, quantity = 1) {
    if (!isReady) {
      setAnnouncement("Your cart is still synchronizing. Please try again.");
      return;
    }
    if (product.availableStock <= 0) return;

    const existing = items.find((item) => item.product.id === product.id);
    const nextQuantity = Math.min(
      (existing?.quantity ?? 0) + quantity,
      product.availableStock
    );

    setItems((current) =>
      existing
        ? current.map((item) =>
            item.product.id === product.id
              ? { ...item, product, quantity: nextQuantity }
              : item
          )
        : [...current, { product, quantity: nextQuantity }]
    );

    if (isAccountCart) {
      void setAccountCartItem(product.id, nextQuantity).catch(handleAccountSyncFailure);
    }
    setAnnouncement(`${product.name} added to cart.`);
  }

  function updateQuantity(productId: string, quantity: number) {
    if (!isReady) return;
    const target = items.find((item) => item.product.id === productId);
    if (!target) return;

    const nextQuantity = Math.min(
      Math.max(Math.round(quantity), 0),
      target.product.availableStock
    );
    setItems((current) =>
      current
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: nextQuantity } : item
        )
        .filter((item) => item.quantity > 0)
    );

    if (isAccountCart) {
      const sync =
        nextQuantity > 0
          ? setAccountCartItem(productId, nextQuantity)
          : removeAccountCartItem(productId);
      void sync.catch(handleAccountSyncFailure);
    }
  }

  function removeItem(productId: string) {
    if (!isReady) return;
    const removed = items.find((item) => item.product.id === productId);
    setItems((current) => current.filter((item) => item.product.id !== productId));
    if (isAccountCart) {
      void removeAccountCartItem(productId).catch(handleAccountSyncFailure);
    }
    if (removed) setAnnouncement(`${removed.product.name} removed from cart.`);
  }

  function clearCart() {
    setItems([]);
    clearGuestCart(localStorage);
    if (isAccountCart) {
      void clearAccountCart().catch(handleAccountSyncFailure);
    }
    setAnnouncement("Cart cleared.");
  }

  return (
    <CartContext.Provider
      value={{
        items: visibleItems,
        itemCount,
        subtotal,
        announcement,
        isReady,
        addItem,
        updateQuantity,
        removeItem,
        clearCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider.");
  return context;
}
