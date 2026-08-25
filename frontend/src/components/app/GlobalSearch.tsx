import {
  ArrowRight,
  Boxes,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Package,
  ReceiptText,
  Search,
  SearchX,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ComponentType, SVGProps } from "react";

import { type AppRoutePath } from "@/app/routes";
import { cn } from "@/lib/utils";
import { searchSystem } from "@/services/searchService";
import type { SearchResponseData } from "@/types/search";

type GlobalSearchProps = {
  onNavigate: (path: AppRoutePath) => void;
};

type SearchStatus = "idle" | "loading" | "ready" | "error";

type SearchResultDisplayItem = {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  path: AppRoutePath;
};

const SEARCH_DEBOUNCE_MS = 220;
const RECENT_SEARCHES_KEY = "ysabellestore.globalSearch.recentSearches";
const RECENT_SEARCHES_LIMIT = 5;

export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [data, setData] = useState<SearchResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = query.trim();
  const hasQuery = normalizedQuery.length > 0;

  const backendProductItems = useMemo(
    () =>
      (data?.products ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        description: item.subtitle,
        badge: item.badge,
        icon: Package,
        path: item.path
      })),
    [data?.products]
  );

  const backendBatchItems = useMemo(
    () =>
      (data?.batches ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        description: item.subtitle,
        badge: item.badge,
        icon: Boxes,
        path: item.path
      })),
    [data?.batches]
  );

  const backendReceiptItems = useMemo(
    () =>
      (data?.receipts ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        description: item.subtitle,
        badge: item.badge,
        icon: ReceiptText,
        path: item.path
      })),
    [data?.receipts]
  );

  const backendActionItems = useMemo(
    () =>
      (data?.actions ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        badge: item.badge,
        icon: ArrowRight,
        path: item.path
      })),
    [data?.actions]
  );

  const hasBackendResults =
    backendProductItems.length > 0 ||
    backendBatchItems.length > 0 ||
    backendReceiptItems.length > 0 ||
    backendActionItems.length > 0;

  const showPanel =
    isOpen &&
    (hasQuery ||
      recentSearches.length > 0 ||
      status === "loading" ||
      status === "error" ||
      Boolean(data));
  const showLoading = isOpen && hasQuery && status === "loading";
  const showError = isOpen && status === "error";
  const showIdle = isOpen && !hasQuery && status === "idle";
  const showNoRecords = Boolean(data && hasQuery && !data.hasSearchableRecords);
  const showNoResults = Boolean(
    data && hasQuery && data.hasSearchableRecords && !hasBackendResults
  );
  const showRecentSearches = isOpen && !hasQuery && recentSearches.length > 0;

  useEffect(() => {
    function handleGlobalShortcut(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      const isModifierShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";

      if (isModifierShortcut) {
        const target = event.target as HTMLElement | null;
        const isTypingField =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.isContentEditable === true;

        if (isTypingField) {
          return;
        }

        event.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        closeSearch();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (!isOpen) {
        return;
      }

      const target = event.target as Node | null;

      if (target && containerRef.current?.contains(target)) {
        return;
      }

      closeSearch();
    }

    window.addEventListener("keydown", handleGlobalShortcut);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleGlobalShortcut);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setStatus("idle");
      setData(null);
      setError(null);
      return;
    }

    if (!hasQuery) {
      setStatus("idle");
      setData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setStatus("loading");

      void searchSystem(normalizedQuery, { signal: controller.signal })
        .then((response) => {
          if (!response.success || !response.data) {
            setData(null);
            setError(response.message);
            setStatus("error");
            return;
          }

          setData(response.data);
          setError(null);
          setStatus("ready");
          saveRecentSearch(normalizedQuery, setRecentSearches);
        })
        .catch((requestError: unknown) => {
          if (controller.signal.aborted) {
            return;
          }

          setData(null);
          setError(requestError instanceof Error ? requestError.message : "Search is unavailable.");
          setStatus("error");
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [hasQuery, isOpen, normalizedQuery]);

  function closeSearch() {
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function clearSearch() {
    setQuery("");
    setError(null);
    setStatus("idle");
    setData(null);
    setIsOpen(true);
    inputRef.current?.focus();
  }

  function handleResultSelect(path: AppRoutePath, searchLabel?: string) {
    if (searchLabel) {
      saveRecentSearch(searchLabel, setRecentSearches);
    } else if (normalizedQuery) {
      saveRecentSearch(normalizedQuery, setRecentSearches);
    }

    closeSearch();
    setQuery("");
    setData(null);
    setStatus("idle");
    onNavigate(path);
  }

  function handleRecentSearchSelect(term: string) {
    setQuery(term);
    setError(null);
    setIsOpen(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function handleClearRecents() {
    setRecentSearches([]);
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
  }

  return (
    <div ref={containerRef} className="relative z-50 w-[min(22rem,42vw)]">
      <label
        className={cn(
          "group/search pointer-events-auto flex h-11 items-center gap-3 rounded-full border border-slate-200/80 bg-white px-4 text-sm text-slate-600 shadow-sm transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:border-emerald-200 hover:bg-white hover:shadow-md focus-within:-translate-y-px focus-within:border-emerald-300 focus-within:bg-white focus-within:shadow-md focus-within:ring-2 focus-within:ring-emerald-500/15"
        )}
      >
        <Search
          className="h-4 w-4 shrink-0 text-slate-400 transition-colors duration-150 ease-out group-hover/search:text-slate-500 group-focus-within/search:text-emerald-600"
          aria-hidden="true"
        />
        <input
          aria-controls="global-search-panel"
          aria-expanded={showPanel}
          aria-haspopup="dialog"
          aria-label="Search products, batches, and receipts"
          autoComplete="off"
          className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          placeholder="Search products, batches, receipts"
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError(null);
            if (!isOpen) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeSearch();
            }
          }}
        />
        {hasQuery ? (
          <button
            aria-label="Clear search"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors duration-150 ease-out hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={clearSearch}
            type="button"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
        <span className="pointer-events-none inline-flex h-6 shrink-0 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium tracking-[0.06em] text-slate-500 shadow-sm">
          Ctrl K
        </span>
      </label>

      {showPanel ? (
        <div
          id="global-search-panel"
          className={cn(
            "pointer-events-auto absolute left-0 top-[calc(100%+0.65rem)] w-full overflow-hidden rounded-2xl border border-emerald-100/70 bg-gradient-to-b from-white to-emerald-50/30 shadow-[0_20px_44px_rgba(15,23,42,0.16)] backdrop-blur-xl"
          )}
          role="dialog"
          aria-label="Global search results"
          onMouseDownCapture={(event) => {
            event.stopPropagation();
          }}
          onPointerDownCapture={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="max-h-[22.5rem] overflow-auto overscroll-contain">
            <SearchPanelBody
              actions={backendActionItems}
              batches={backendBatchItems}
              error={error}
              isError={showError}
              isIdle={showIdle}
              isLoading={showLoading}
              noRecords={showNoRecords}
              noResults={showNoResults}
              onClearRecents={handleClearRecents}
              onNavigate={handleResultSelect}
              onRecentSearchSelect={handleRecentSearchSelect}
              products={backendProductItems}
              recentSearches={recentSearches}
              receipts={backendReceiptItems}
              showRecentSearches={showRecentSearches}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SearchPanelBodyProps = {
  actions: readonly SearchResultDisplayItem[];
  batches: readonly SearchResultDisplayItem[];
  error: string | null;
  isError: boolean;
  isIdle: boolean;
  isLoading: boolean;
  noRecords: boolean;
  noResults: boolean;
  onClearRecents: () => void;
  onNavigate: (path: AppRoutePath, searchLabel?: string) => void;
  onRecentSearchSelect: (term: string) => void;
  products: readonly SearchResultDisplayItem[];
  recentSearches: readonly string[];
  receipts: readonly SearchResultDisplayItem[];
  showRecentSearches: boolean;
};

function SearchPanelBody({
  actions,
  batches,
  error,
  isError,
  isIdle,
  isLoading,
  noRecords,
  noResults,
  onClearRecents,
  onNavigate,
  onRecentSearchSelect,
  products,
  recentSearches,
  receipts,
  showRecentSearches
}: SearchPanelBodyProps) {
  const hasAnyResults =
    actions.length > 0 || batches.length > 0 || products.length > 0 || receipts.length > 0;

  return (
    <div className="space-y-3 px-2 py-2.5">
      {isLoading ? (
        <CompactStatusRow
          icon={LoaderCircle}
          title="Searching YsabelleStore..."
          subtitle="Looking through products, batches, receipts, and modules."
          spinning
        />
      ) : null}

      {isError ? (
        <CompactEmptyState title="Search unavailable" description={error ?? "Please try again."} />
      ) : null}

      {!isLoading && !isError && !isIdle && hasAnyResults ? (
        <div className="space-y-3">
          {products.length > 0 ? (
            <CompactResultSection items={products} title="PRODUCTS" onNavigate={onNavigate} />
          ) : null}
          {batches.length > 0 ? (
            <CompactResultSection items={batches} title="BATCHES" onNavigate={onNavigate} />
          ) : null}
          {receipts.length > 0 ? (
            <CompactResultSection items={receipts} title="RECEIPTS" onNavigate={onNavigate} />
          ) : null}
          {actions.length > 0 ? (
            <CompactResultSection items={actions} title="ACTIONS" onNavigate={onNavigate} />
          ) : null}
        </div>
      ) : null}

      {noRecords ? (
        <CompactEmptyState
          title="No searchable records yet"
          description="Products, batches, and receipts will appear here once records are added."
        />
      ) : null}

      {noResults ? (
        <CompactEmptyState
          title="No results found"
          description="Try another product, batch, receipt, or module name."
        />
      ) : null}

      {showRecentSearches ? (
        <RecentSearchesSection
          recentSearches={recentSearches}
          onClear={onClearRecents}
          onSelect={onRecentSearchSelect}
        />
      ) : null}
    </div>
  );
}

function CompactResultSection({
  items,
  onNavigate,
  title
}: {
  items: readonly SearchResultDisplayItem[];
  onNavigate: (path: AppRoutePath, searchLabel?: string) => void;
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <SectionHeading label={title} />
      <div className="space-y-1">
        {items.map((item) => (
          <CompactRow
            key={item.id}
            icon={item.icon}
            title={item.label}
            subtitle={item.description}
            badge={item.badge}
            onClick={() => onNavigate(item.path, item.label)}
          />
        ))}
      </div>
    </section>
  );
}

function RecentSearchesSection({
  recentSearches,
  onClear,
  onSelect
}: {
  recentSearches: readonly string[];
  onClear: () => void;
  onSelect: (term: string) => void;
}) {
  if (recentSearches.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <SectionHeading label="RECENT SEARCHES" />
        <button
          className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={onClear}
          type="button"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {recentSearches.map((term) => (
          <button
            key={term}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/70 px-3 py-1.5 text-xs font-medium text-emerald-800 transition-colors hover:border-emerald-200 hover:bg-emerald-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => onSelect(term)}
            type="button"
          >
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="max-w-[10rem] truncate">{term}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CompactRow({
  badge,
  icon: Icon,
  onClick,
  subtitle,
  title
}: {
  badge?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  onClick: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <button
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 ease-out hover:bg-emerald-50/70 focus-visible:bg-emerald-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20"
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
      type="button"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors duration-150 ease-out group-hover:bg-emerald-100 group-hover:text-emerald-700">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-medium text-slate-950">{title}</span>
          {badge ? (
            <span className="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              {badge}
            </span>
          ) : null}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-xs leading-5 text-slate-500">{subtitle}</span>
        ) : null}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-emerald-500"
        aria-hidden="true"
      />
    </button>
  );
}

function CompactStatusRow({
  icon: Icon,
  spinning,
  subtitle,
  title
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  spinning?: boolean;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-100/80 bg-emerald-50/40 px-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm">
        <Icon className={cn("h-4 w-4", spinning && "animate-spin")} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-950">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{subtitle}</span>
      </span>
    </div>
  );
}

function CompactEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 bg-white/80 px-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <SearchX className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-950">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </div>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between px-1">
      <p className="type-label text-slate-500">{label}</p>
    </div>
  );
}

function loadRecentSearches() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]") as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .slice(0, RECENT_SEARCHES_LIMIT);
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string, setRecentSearches: Dispatch<SetStateAction<string[]>>) {
  const normalizedTerm = term.trim();

  if (!normalizedTerm) {
    return;
  }

  setRecentSearches((current) => {
    const next = [normalizedTerm, ...current.filter((item) => item !== normalizedTerm)].slice(
      0,
      RECENT_SEARCHES_LIMIT
    );

    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    return next;
  });
}
