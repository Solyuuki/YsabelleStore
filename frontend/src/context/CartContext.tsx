import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { StorefrontProduct } from "@/types/storefront";

const CART_STORAGE_KEY = "ysabelle:customer-cart:v1";

export type CartItem = {
  product: StorefrontProduct;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  announcement: string;
  addItem: (product: StorefrontProduct, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "[]") as CartItem[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item) =>
            item?.product?.id &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0 &&
            item.product.availableStock > 0
        )
      : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce(
    (total, item) => total + Number(item.product.sellingPrice) * item.quantity,
    0
  );

  function addItem(product: StorefrontProduct, quantity = 1) {
    if (product.availableStock <= 0) return;
    setItems((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (!existing) {
        return [...current, { product, quantity: Math.min(quantity, product.availableStock) }];
      }
      return current.map((item) =>
        item.product.id === product.id
          ? {
              ...item,
              product,
              quantity: Math.min(item.quantity + quantity, product.availableStock)
            }
          : item
      );
    });
    setAnnouncement(`${product.name} added to cart.`);
  }

  function updateQuantity(productId: string, quantity: number) {
    setItems((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity: Math.min(Math.max(Math.round(quantity), 0), item.product.availableStock)
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    const removed = items.find((item) => item.product.id === productId);
    setItems((current) => current.filter((item) => item.product.id !== productId));
    if (removed) setAnnouncement(`${removed.product.name} removed from cart.`);
  }

  function clearCart() {
    setItems([]);
    setAnnouncement("Cart cleared.");
  }

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        announcement,
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
