import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from "react";

import { getRouteByPath } from "@/app/routes";

export type AppearanceMode = "light" | "dark";
type AppearanceScope = "storefront" | "retail";

export const STOREFRONT_THEME_KEY = "ysabellestore.appearance.storefront.v1";
export const RETAIL_THEME_KEY = "ysabellestore.appearance.retail.v1";

function readTheme(key: string): AppearanceMode {
  try {
    return window.localStorage.getItem(key) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function saveTheme(key: string, value: AppearanceMode) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The selected theme still works for this session if storage is unavailable.
  }
}

export function getAppearanceScope(pathname: string): AppearanceScope {
  return pathname !== "/" && getRouteByPath(pathname) ? "retail" : "storefront";
}

export function applyAppearanceForPath(
  pathname: string,
  storefrontTheme: AppearanceMode,
  retailTheme: AppearanceMode
) {
  const scope = getAppearanceScope(pathname);
  // About's approved video/scene palette is intentionally identical in both preferences.
  const preserveAbout = pathname === "/about" || pathname === "/discover";
  const isReceiptPrint = new URLSearchParams(window.location.search).get("print") === "receipt";
  const dark = !preserveAbout && !isReceiptPrint && (scope === "storefront" ? storefrontTheme : retailTheme) === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.dataset.appearanceScope = scope;
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0d1425" : "#625bff");
}

type AppearanceContextValue = {
  storefrontTheme: AppearanceMode;
  retailTheme: AppearanceMode;
  setStorefrontTheme: (value: AppearanceMode) => void;
  setRetailTheme: (value: AppearanceMode) => void;
  syncForPath: (pathname: string) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [storefrontTheme, setStorefrontPreference] = useState<AppearanceMode>(() => readTheme(STOREFRONT_THEME_KEY));
  const [retailTheme, setRetailPreference] = useState<AppearanceMode>(() => readTheme(RETAIL_THEME_KEY));

  const setStorefrontTheme = useCallback((value: AppearanceMode) => {
    setStorefrontPreference(value);
    saveTheme(STOREFRONT_THEME_KEY, value);
  }, []);

  const setRetailTheme = useCallback((value: AppearanceMode) => {
    setRetailPreference(value);
    saveTheme(RETAIL_THEME_KEY, value);
  }, []);

  const syncForPath = useCallback(
    (pathname: string) => applyAppearanceForPath(pathname, storefrontTheme, retailTheme),
    [storefrontTheme, retailTheme]
  );

  useLayoutEffect(() => {
    syncForPath(window.location.pathname);
  }, [syncForPath]);

  return (
    <AppearanceContext.Provider value={{ storefrontTheme, retailTheme, setStorefrontTheme, setRetailTheme, syncForPath }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used within AppearanceProvider");
  return context;
}
