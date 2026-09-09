import { useRef, useState, type MouseEvent } from "react";

import { ProductPackageImportDialog } from "@/components/catalog/ProductPackageImportDialog";
import { ProductsPage as CatalogProductsPage } from "@/pages/ProductsPage";

/**
 * Migration adapter for the Products workspace while the legacy spreadsheet importer
 * remains colocated inside ProductsPage. It intercepts only the existing Import Products
 * action and routes that action to the package importer without changing any other catalog UI.
 * The legacy import dialog is never opened through the user-facing action.
 */
export function ProductsPagePackageImport() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const importTriggerRef = useRef<HTMLButtonElement | null>(null);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.textContent?.trim() !== "Import Products") return;

    event.preventDefault();
    event.stopPropagation();
    importTriggerRef.current = button;
    setIsImportOpen(true);
  }

  return (
    <>
      <div onClickCapture={handleClickCapture}>
        <CatalogProductsPage />
      </div>
      <ProductPackageImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={() => {
          // CatalogProductsPage refreshes naturally on the next catalog interaction.
          // Reloading here guarantees the just-imported catalog/inventory state is authoritative.
          window.location.reload();
        }}
        triggerRef={importTriggerRef}
      />
    </>
  );
}
