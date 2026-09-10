import { useEffect, useRef, useState } from "react";

import {
  ProductCatalogQoLEnhancements,
  type CatalogSortOrder
} from "@/components/catalog/ProductCatalogQoLEnhancements";
import { ProductPackageImportDialog } from "@/components/catalog/ProductPackageImportDialog";
import { ProductsPage as ProductsPageLegacy } from "@/pages/ProductsPageLegacy";
import "@/pages/products-page-overrides.css";
import { apiClient } from "@/services/apiClient";

const IMPORT_BUTTON_LABEL = "Import Products";
const PACKAGE_SCAN_MINIMUM_MS = 700;

let activeCatalogSortOrder: CatalogSortOrder = "desc";
let qolInterceptorRegistered = false;

if (!qolInterceptorRegistered) {
  qolInterceptorRegistered = true;
  apiClient.addRequestInterceptor(async (context) => {
    const method = (context.init.method ?? "GET").toUpperCase();
    const pathname = context.url.pathname;

    if (method === "GET" && pathname === "/api/catalog/products") {
      const url = new URL(context.url);
      url.searchParams.set("sortBy", "createdAt");
      url.searchParams.set("sortOrder", activeCatalogSortOrder);
      return { ...context, url };
    }

    if (
      method === "POST" &&
      (pathname === "/api/catalog/products/import/preview" ||
        pathname === "/api/catalog/products/import/google-drive/preview")
    ) {
      await new Promise((resolve) => window.setTimeout(resolve, PACKAGE_SCAN_MINIMUM_MS));
    }

    return context;
  });
}

export function ProductsPage() {
  const [isPackageImportOpen, setIsPackageImportOpen] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [sortOrder, setSortOrder] = useState<CatalogSortOrder>("desc");
  const importTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function interceptLegacyImportTrigger(event: MouseEvent) {
      if (isPackageImportOpen || !window.location.pathname.endsWith("/products")) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      if (button.textContent?.trim() !== IMPORT_BUTTON_LABEL) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      importTriggerRef.current = button;
      setIsPackageImportOpen(true);
    }

    document.addEventListener("click", interceptLegacyImportTrigger, true);
    return () => {
      document.removeEventListener("click", interceptLegacyImportTrigger, true);
    };
  }, [isPackageImportOpen]);

  function handleSortOrderChange(nextOrder: CatalogSortOrder) {
    if (nextOrder === sortOrder) return;
    activeCatalogSortOrder = nextOrder;
    setSortOrder(nextOrder);
    setCatalogRevision((current) => current + 1);
  }

  return (
    <>
      <div className="products-page-no-actions contents">
        <ProductsPageLegacy key={catalogRevision} />
      </div>
      <ProductCatalogQoLEnhancements
        onSortOrderChange={handleSortOrderChange}
        sortOrder={sortOrder}
      />
      <ProductPackageImportDialog
        isOpen={isPackageImportOpen}
        onClose={() => setIsPackageImportOpen(false)}
        onImported={() => {
          setCatalogRevision((current) => current + 1);
        }}
        triggerRef={importTriggerRef}
      />
    </>
  );
}
