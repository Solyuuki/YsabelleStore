import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type CatalogSortOrder = "asc" | "desc";

type PortalHosts = {
  qualityIcon: HTMLElement | null;
  sort: HTMLElement | null;
  statusIcon: HTMLElement | null;
};

const EMPTY_HOSTS: PortalHosts = {
  qualityIcon: null,
  sort: null,
  statusIcon: null
};

export function ProductCatalogQoLEnhancements({
  sortOrder,
  onSortOrderChange
}: {
  sortOrder: CatalogSortOrder;
  onSortOrderChange: (order: CatalogSortOrder) => void;
}) {
  const [hosts, setHosts] = useState<PortalHosts>(EMPTY_HOSTS);

  useEffect(() => {
    let statusFilterIcon: SVGElement | null = null;
    let qualityFilterIcon: SVGElement | null = null;

    function markPackageSelection() {
      const dropZone = document.querySelector<HTMLElement>('[aria-label="Upload product package"]');
      if (!dropZone) return;

      const removeButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim() === "Remove"
      );
      const fileCard = removeButton?.closest<HTMLElement>("div.rounded-2xl");

      if (fileCard) {
        dropZone.dataset.packageDropzone = "selected";
        fileCard.dataset.packageFileCard = "true";
      } else {
        delete dropZone.dataset.packageDropzone;
      }
    }

    function wireCatalogToolbar() {
      const allSelects = Array.from(document.querySelectorAll<HTMLSelectElement>("select"));
      const statusSelect = allSelects.find((select) =>
        Array.from(select.options).some((option) => option.textContent?.trim() === "All statuses")
      );
      const qualitySelect = document.querySelector<HTMLSelectElement>('select[aria-label="Catalog quality"]');
      const statusLabel = statusSelect?.closest<HTMLLabelElement>("label");
      const qualityLabel = qualitySelect?.closest<HTMLLabelElement>("label");
      const toolbar = statusLabel?.parentElement;

      if (!statusSelect || !qualitySelect || !statusLabel || !qualityLabel || !toolbar) return;

      toolbar.dataset.catalogToolbarQol = "true";
      statusSelect.setAttribute("aria-label", "Product availability");

      statusFilterIcon = statusLabel.querySelector<SVGElement>("svg");
      qualityFilterIcon = qualityLabel.querySelector<SVGElement>("svg");
      if (statusFilterIcon) statusFilterIcon.style.display = "none";
      if (qualityFilterIcon) qualityFilterIcon.style.display = "none";

      let statusIconHost = statusLabel.querySelector<HTMLElement>('[data-qol-status-icon="true"]');
      if (!statusIconHost) {
        statusIconHost = document.createElement("span");
        statusIconHost.dataset.qolStatusIcon = "true";
        statusIconHost.className = "flex shrink-0 items-center text-slate-500";
        statusLabel.insertBefore(statusIconHost, statusSelect);
      }

      let qualityIconHost = qualityLabel.querySelector<HTMLElement>('[data-qol-quality-icon="true"]');
      if (!qualityIconHost) {
        qualityIconHost = document.createElement("span");
        qualityIconHost.dataset.qolQualityIcon = "true";
        qualityIconHost.className = "flex shrink-0 items-center text-slate-500";
        qualityLabel.insertBefore(qualityIconHost, qualitySelect);
      }

      let sortHost = toolbar.querySelector<HTMLElement>('[data-qol-sort-host="true"]');
      if (!sortHost) {
        sortHost = document.createElement("span");
        sortHost.dataset.qolSortHost = "true";
        sortHost.style.display = "contents";
        toolbar.appendChild(sortHost);
      }

      setHosts((current) => {
        if (
          current.statusIcon === statusIconHost &&
          current.qualityIcon === qualityIconHost &&
          current.sort === sortHost
        ) {
          return current;
        }
        return { statusIcon: statusIconHost, qualityIcon: qualityIconHost, sort: sortHost };
      });
    }

    function syncEnhancements() {
      wireCatalogToolbar();
      markPackageSelection();
    }

    syncEnhancements();
    const observer = new MutationObserver(syncEnhancements);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (statusFilterIcon) statusFilterIcon.style.display = "";
      if (qualityFilterIcon) qualityFilterIcon.style.display = "";
      document.querySelectorAll('[data-qol-status-icon="true"], [data-qol-quality-icon="true"], [data-qol-sort-host="true"]').forEach((node) => node.remove());
      document.querySelectorAll<HTMLElement>('[data-catalog-toolbar-qol="true"]').forEach((node) => delete node.dataset.catalogToolbarQol);
      document.querySelectorAll<HTMLElement>('[data-package-dropzone="selected"]').forEach((node) => delete node.dataset.packageDropzone);
      document.querySelectorAll<HTMLElement>('[data-package-file-card="true"]').forEach((node) => delete node.dataset.packageFileCard);
      setHosts(EMPTY_HOSTS);
    };
  }, []);

  return (
    <>
      <style>{`
        @media (min-width: 768px) {
          [data-catalog-toolbar-qol="true"] {
            grid-template-columns: minmax(0, 1fr) 180px 180px 180px !important;
          }
        }
        [data-package-dropzone="selected"] {
          display: none !important;
        }
        [data-package-file-card="true"] {
          min-height: 150px;
          border-style: dashed !important;
          border-color: rgb(196 181 253) !important;
          background: rgb(245 243 255 / 0.72) !important;
          display: flex;
          align-items: center;
        }
        [data-package-file-card="true"] > div {
          width: 100%;
        }
      `}</style>

      {hosts.statusIcon
        ? createPortal(<AvailabilityIcon />, hosts.statusIcon)
        : null}
      {hosts.qualityIcon
        ? createPortal(<QualityIcon />, hosts.qualityIcon)
        : null}
      {hosts.sort
        ? createPortal(
            <label className="relative flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm">
              <SortIcon />
              <select
                aria-label="Product order"
                className="w-full bg-transparent outline-none"
                onChange={(event) => onSortOrderChange(event.target.value as CatalogSortOrder)}
                value={sortOrder}
              >
                <option value="desc">Latest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </label>,
            hosts.sort
          )
        : null}
    </>
  );
}

function AvailabilityIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

function QualityIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 5 6v5c0 4.7 2.9 8.3 7 10 4.1-1.7 7-5.3 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.7 1.7 3.5-3.7" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h10" />
      <path d="M8 12h7" />
      <path d="M8 18h4" />
      <path d="m4 4-2 2 2 2" />
      <path d="M2 6v12" />
    </svg>
  );
}
