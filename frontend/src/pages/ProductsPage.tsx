import { useEffect, useRef, useState } from "react";

import { ProductPackageImportDialog } from "@/components/catalog/ProductPackageImportDialog";
import { ProductsPage as ProductsPageLegacy } from "@/pages/ProductsPageLegacy";

const IMPORT_BUTTON_LABEL = "Import Products";

export function ProductsPage() {
  const [isPackageImportOpen, setIsPackageImportOpen] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
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

  return (
    <>
      <ProductsPageLegacy key={catalogRevision} />
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
