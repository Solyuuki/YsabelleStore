import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { useCustomerAuth } from "@/context/CustomerAuthContext";
import {
  addCustomerFavorite,
  fetchCustomerFavorites,
  removeCustomerFavorite
} from "@/services/customerAccountService";
import type { StorefrontFavoriteProduct } from "@/types/storefront";

const PENDING_FAVORITE_KEY = "ysabelle:pending-favorite";

type CustomerFavoritesContextValue = {
  favoriteProducts: StorefrontFavoriteProduct[];
  favoriteIds: ReadonlySet<string>;
  loading: boolean;
  refreshFavorites: () => Promise<void>;
  toggleFavorite: (productId: string) => Promise<"saved" | "removed" | "auth-required">;
};

const CustomerFavoritesContext = createContext<CustomerFavoritesContextValue | null>(null);

export function CustomerFavoritesProvider({ children }: { children: ReactNode }) {
  const { status } = useCustomerAuth();
  const [favoriteProducts, setFavoriteProducts] = useState<StorefrontFavoriteProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshFavorites = useCallback(async () => {
    if (status !== "authenticated") {
      setFavoriteProducts([]);
      return;
    }

    setLoading(true);
    try {
      setFavoriteProducts(await fetchCustomerFavorites());
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refreshFavorites();
  }, [refreshFavorites]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const pendingProductId = window.localStorage.getItem(PENDING_FAVORITE_KEY);
    if (!pendingProductId) return;

    void addCustomerFavorite(pendingProductId)
      .then(() => {
        window.localStorage.removeItem(PENDING_FAVORITE_KEY);
        return refreshFavorites();
      })
      .catch(() => {
        // Keep the pending intent so it can be retried after a healthy authenticated session.
      });
  }, [refreshFavorites, status]);

  const favoriteIds = useMemo(
    () => new Set(favoriteProducts.map((product) => product.id)),
    [favoriteProducts]
  );

  const toggleFavorite = useCallback(
    async (productId: string) => {
      if (status !== "authenticated") {
        window.localStorage.setItem(PENDING_FAVORITE_KEY, productId);
        return "auth-required" as const;
      }

      if (favoriteIds.has(productId)) {
        await removeCustomerFavorite(productId);
        setFavoriteProducts((current) => current.filter((product) => product.id !== productId));
        return "removed" as const;
      }

      await addCustomerFavorite(productId);
      await refreshFavorites();
      return "saved" as const;
    },
    [favoriteIds, refreshFavorites, status]
  );

  const value = useMemo(
    () => ({ favoriteProducts, favoriteIds, loading, refreshFavorites, toggleFavorite }),
    [favoriteIds, favoriteProducts, loading, refreshFavorites, toggleFavorite]
  );

  return (
    <CustomerFavoritesContext.Provider value={value}>{children}</CustomerFavoritesContext.Provider>
  );
}

export function useCustomerFavorites() {
  const value = useContext(CustomerFavoritesContext);
  if (!value) {
    throw new Error("useCustomerFavorites must be used inside CustomerFavoritesProvider.");
  }
  return value;
}
