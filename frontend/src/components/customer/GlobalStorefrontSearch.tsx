import { Autocomplete } from "@base-ui/react/autocomplete";
import { Clock3, LoaderCircle, PackageSearch, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";

import { fetchStorefrontProducts } from "@/services/storefrontService";
import type { StorefrontProduct } from "@/types/storefront";
import {
  clearRecentStorefrontSearches,
  normalizeStorefrontSearchQuery,
  readRecentStorefrontSearches,
  recordRecentStorefrontSearch,
  removeRecentStorefrontSearch,
  STOREFRONT_SEARCH_QUERY_MAX_LENGTH
} from "@/utils/storefrontSearchHistory";

const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_SUGGESTION_LIMIT = 6;

type SearchState = "error" | "idle" | "loading" | "success";

export function GlobalStorefrontSearch({
  enabled = true,
  location,
  navigate
}: {
  enabled?: boolean;
  location: string;
  navigate: (path: string) => void;
}) {
  const locationQuery = getLocationSearchQuery(location);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState(locationQuery);
  const [open, setOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => readRecentStorefrontSearches());
  const [suggestions, setSuggestions] = useState<StorefrontProduct[]>([]);
  const [highlightedProduct, setHighlightedProduct] = useState<StorefrontProduct | null>(null);
  const [searchState, setSearchState] = useState<SearchState>("idle");

  const normalizedQuery = normalizeStorefrontSearchQuery(searchValue);
  const isRecentMode = !normalizedQuery;

  useEffect(() => {
    setSearchValue(locationQuery);
    setOpen(false);
  }, [locationQuery]);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      setHighlightedProduct(null);
      setSuggestions([]);
      setSearchState("idle");
      return;
    }

    if (!normalizedQuery) {
      setHighlightedProduct(null);
      setSuggestions([]);
      setSearchState("idle");
      return;
    }

    const controller = new AbortController();
    setHighlightedProduct(null);
    setSuggestions([]);
    setSearchState("loading");
    const timer = window.setTimeout(() => {
      void fetchStorefrontProducts(
        {
          availability: "all",
          page: 1,
          pageSize: SEARCH_SUGGESTION_LIMIT,
          search: normalizedQuery
        },
        controller.signal
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          setSuggestions(result.items);
          setSearchState("success");
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setSuggestions([]);
          setSearchState("error");
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, normalizedQuery]);

  function rememberSearch(query: string) {
    setRecentSearches(recordRecentStorefrontSearch(query));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuery();
  }

  function submitQuery() {
    const query = normalizeStorefrontSearchQuery(searchValue);
    setOpen(false);

    if (!query) {
      navigate("/shop");
      return;
    }

    rememberSearch(query);
    navigate(`/shop?search=${encodeURIComponent(query)}`);
  }

  function selectProduct(product: StorefrontProduct) {
    setOpen(false);
    rememberSearch(product.name);
    navigate(`/product/${encodeURIComponent(product.id)}`);
  }

  function selectRecentSearch(query: string) {
    setOpen(false);
    setSearchValue(query);
    rememberSearch(query);
    navigate(`/shop?search=${encodeURIComponent(query)}`);
  }

  function removeRecentSearch(query: string, event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setRecentSearches(removeRecentStorefrontSearch(query));
  }

  function clearAllRecentSearches() {
    clearRecentStorefrontSearches();
    setRecentSearches([]);
  }

  function clearSearchInput() {
    setSearchValue("");
    setOpen(true);
    inputRef.current?.focus();
  }

  const statusMessage = getStatusMessage({
    hasRecentSearches: recentSearches.length > 0,
    query: normalizedQuery,
    searchState,
    suggestionCount: suggestions.length
  });

  return (
    <form
      className="customer-global-search"
      data-tour="search"
      onSubmit={submitSearch}
      role="search"
    >
      <label className="sr-only" htmlFor="customer-global-search">
        Search the Ysabelle&apos;s Store catalog
      </label>
      <Autocomplete.Root
        filter={null}
        itemToStringValue={(product) => product.name}
        items={suggestions}
        onItemHighlighted={(product) => setHighlightedProduct(product ?? null)}
        onOpenChange={(nextOpen) => {
          if (enabled) setOpen(nextOpen);
        }}
        onValueChange={(nextValue, details) => {
          if (details.reason !== "item-press") {
            setHighlightedProduct(null);
            setSearchValue(nextValue);
          }
        }}
        open={enabled && open}
        openOnInputClick={enabled}
        value={searchValue}
      >
        <Autocomplete.InputGroup className="customer-global-search__shell">
          <Search aria-hidden="true" className="customer-global-search__icon" size={18} />
          <Autocomplete.Input
            autoComplete="off"
            id="customer-global-search"
            inputMode="search"
            maxLength={STOREFRONT_SEARCH_QUERY_MAX_LENGTH}
            onFocus={() => {
              if (enabled) setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (highlightedProduct) selectProduct(highlightedProduct);
                else submitQuery();
              }
            }}
            placeholder="Search the store"
            ref={inputRef}
            type="text"
          />
          {searchValue ? (
            <button
              aria-label="Clear search"
              className="customer-global-search__clear"
              onClick={clearSearchInput}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          ) : null}
        </Autocomplete.InputGroup>

        {enabled ? (
          <Autocomplete.Portal>
            <Autocomplete.Positioner
              align="start"
              className="customer-global-search__positioner"
              sideOffset={8}
            >
              <Autocomplete.Popup
                aria-busy={searchState === "loading" || undefined}
                aria-label={isRecentMode ? "Recent searches" : "Search suggestions"}
                className="customer-global-search__popup"
                initialFocus={false}
              >
                <div className="customer-global-search__popup-header">
                  <span>{isRecentMode ? "Recent searches" : "Suggestions"}</span>
                  {isRecentMode && recentSearches.length ? (
                    <button onClick={clearAllRecentSearches} type="button">
                      Clear all
                    </button>
                  ) : null}
                </div>
                <Autocomplete.Status className="sr-only">{statusMessage}</Autocomplete.Status>

                {isRecentMode && recentSearches.length ? (
                  <ul className="customer-global-search__recent-list">
                    {recentSearches.map((query) => (
                      <li key={query.toLowerCase()}>
                        <button
                          className="customer-global-search__recent-action"
                          onClick={() => selectRecentSearch(query)}
                          type="button"
                        >
                          <Clock3
                            aria-hidden="true"
                            className="customer-global-search__item-icon"
                            size={17}
                          />
                          <span className="customer-global-search__recent-query">{query}</span>
                        </button>
                        <button
                          aria-label={`Remove ${query} from recent searches`}
                          className="customer-global-search__remove-recent"
                          onClick={(event) => removeRecentSearch(query, event)}
                          type="button"
                        >
                          <X aria-hidden="true" size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {normalizedQuery ? (
                  <Autocomplete.List className="customer-global-search__list">
                    {(product: StorefrontProduct) => (
                      <Autocomplete.Item
                        className="customer-global-search__item customer-global-search__item--product"
                        key={product.id}
                        onClick={() => selectProduct(product)}
                        value={product}
                      >
                        <PackageSearch
                          aria-hidden="true"
                          className="customer-global-search__item-icon"
                          size={17}
                        />
                        <span className="customer-global-search__product-copy">
                          <strong>{product.name}</strong>
                          <span>
                            {product.category.name} - {getAvailabilityLabel(product)}
                          </span>
                        </span>
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.List>
                ) : null}

                <Autocomplete.Empty
                  className={`customer-global-search__empty ${
                    isRecentMode && recentSearches.length
                      ? "customer-global-search__empty--silent"
                      : ""
                  }`}
                >
                  {isRecentMode && recentSearches.length ? null : searchState === "loading" ? (
                    <>
                      <LoaderCircle
                        aria-hidden="true"
                        className="customer-global-search__spinner"
                        size={18}
                      />
                      Searching the live catalog...
                    </>
                  ) : searchState === "error" ? (
                    "Suggestions are temporarily unavailable. Press Enter to search the full catalog."
                  ) : normalizedQuery ? (
                    `No products found for "${normalizedQuery}". Press Enter to view all matching results.`
                  ) : (
                    "Recent searches will appear here after you search or select a product."
                  )}
                </Autocomplete.Empty>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        ) : null}
      </Autocomplete.Root>
    </form>
  );
}

function getLocationSearchQuery(location: string) {
  try {
    return normalizeStorefrontSearchQuery(
      new URL(location, window.location.origin).searchParams.get("search") ?? ""
    );
  } catch {
    return "";
  }
}

function getAvailabilityLabel(product: StorefrontProduct) {
  if (product.availableStock <= 0) return "Out of stock";
  if (product.stockStatus === "LOW_STOCK") return `Only ${product.availableStock} left`;
  return "In stock";
}

function getStatusMessage({
  hasRecentSearches,
  query,
  searchState,
  suggestionCount
}: {
  hasRecentSearches: boolean;
  query: string;
  searchState: SearchState;
  suggestionCount: number;
}) {
  if (!query) {
    return hasRecentSearches ? "Recent searches are available." : "No recent searches.";
  }
  if (searchState === "loading") return "Searching the live catalog.";
  if (searchState === "error") return "Search suggestions are temporarily unavailable.";
  if (suggestionCount === 0) return `No suggestions found for ${query}.`;
  return `${suggestionCount} suggestion${suggestionCount === 1 ? "" : "s"} found.`;
}
