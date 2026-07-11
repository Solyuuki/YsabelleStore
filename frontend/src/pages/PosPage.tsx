import {
  LoaderCircle,
  Minus,
  PackageSearch,
  Plus,
  ReceiptText,
  ScanBarcode,
  Search,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { RetailReceiptDialog } from "@/components/receipt/RetailReceiptDialog";
import { useToast } from "@/components/shared/ToastProvider";
import { EmptyState } from "@/components/shared/EmptyState";
import { AppPagination } from "@/components/shared/AppPagination";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkoutPosSale, searchPosProducts } from "@/services/posService";
import type { PosProduct, PosSale } from "@/types/pos";
import { requestReceiptPrint } from "@/services/receiptPrint";
import { buildRetailReceiptDataFromSale } from "@/utils/receipt";
import { wait, waitForMinimumDuration } from "@/utils/timing";

type CartLine = {
  product: PosProduct;
  quantity: number;
};

type SearchState = {
  catalogCount: number;
  error: string | null;
  hasSearched: boolean;
  isLoading: boolean;
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  products: PosProduct[];
  query: string;
  status: "ready" | "searching" | "found" | "no-match" | "error";
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const PRODUCT_RESULTS_PAGE_SIZE = 10;

const initialSearchState: SearchState = {
  catalogCount: 0,
  error: null,
  hasSearched: false,
  isLoading: false,
  meta: {
    page: 1,
    pageSize: PRODUCT_RESULTS_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0
  },
  products: [],
  query: "",
  status: "ready"
};

const MIN_SEARCH_LOADING_MS = 300;

export function PosPage() {
  const [searchState, setSearchState] = useState<SearchState>(initialSearchState);
  const [searchInput, setSearchInput] = useState("");
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [productResultsPage, setProductResultsPage] = useState(1);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [receiptSale, setReceiptSale] = useState<PosSale | null>(null);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [receiptPrintError, setReceiptPrintError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      scannerInputRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  const cartSummary = useMemo(() => {
    const subtotal = cartLines.reduce(
      (sum, line) => sum + Number(line.product.sellingPrice) * line.quantity,
      0
    );

    return {
      itemCount: cartLines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      total: subtotal
    };
  }, [cartLines]);

  useEffect(() => {
    setProductResultsPage(1);
  }, [searchState.query]);

  const shouldShowNoResults = searchState.status === "no-match";

  const searchBadge =
    searchState.status === "searching"
      ? {
          label: "Searching",
          variant: "info" as const
        }
      : searchState.status === "error"
        ? {
            label: "Error",
            variant: "error" as const
          }
        : searchState.status === "found"
          ? {
              label: "Found",
              variant: "success" as const
            }
          : searchState.status === "no-match"
            ? {
                label: "No match",
                variant: "warning" as const
              }
            : {
                label: "Scanner ready",
                variant: "info" as const
              };

  const cartBadge = isCheckingOut
    ? {
        label: "Processing",
        variant: "info" as const
      }
    : checkoutError
      ? {
          label: "Error",
          variant: "error" as const
        }
      : cartLines.length > 0
        ? {
            label: "Active",
            variant: "success" as const
          }
        : {
            label: "Empty",
            variant: "warning" as const
          };

  function focusScannerInput() {
    scannerInputRef.current?.focus({ preventScroll: true });
  }

  function clearScannerInput() {
    setSearchInput("");
  }

  function resolveExactProductMatch(query: string, products: PosProduct[]) {
    const normalizedQuery = query.trim().toLowerCase();

    return (
      products.find((product) => product.barcode?.toLowerCase() === normalizedQuery) ??
      products.find((product) => product.sku.toLowerCase() === normalizedQuery) ??
      null
    );
  }

  function addProductToCart(
    product: PosProduct,
    options: { announceAdded?: boolean; clearScannerAfterAction?: boolean } = {}
  ) {
    if (product.availableStock <= 0) {
      const message = "This product is out of stock.";
      setCheckoutError(message);
      setSearchState((current) => ({
        ...current,
        error: message,
        status: "error"
      }));
      return false;
    }

    setCheckoutError(null);
    setSearchState((current) => ({
      ...current,
      error: null,
      status: "found"
    }));

    let added = false;

    setCartLines((currentLines) => {
      const existingLine = currentLines.find((line) => line.product.id === product.id);

      if (!existingLine) {
        added = true;
        return [...currentLines, { product, quantity: 1 }];
      }

      if (existingLine.quantity >= product.availableStock) {
        const message = `Only ${product.availableStock} units are available for ${product.name}.`;
        setCheckoutError(message);
        setSearchState((current) => ({
          ...current,
          error: message,
          status: "error"
        }));
        return currentLines;
      }

      added = true;
      return currentLines.map((line) =>
        line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
      );
    });

    if (added && options.clearScannerAfterAction !== false) {
      clearScannerInput();
      focusScannerInput();
    }

    if (added && options.announceAdded) {
      pushToast({
        message: `${product.name} added to the current sale.`,
        title: "Product added",
        variant: "success"
      });
    }

    return added;
  }

  async function handleSearch(options: { autoAddExactMatch?: boolean; page?: number } = {}) {
    const trimmedQuery = searchInput.trim();
    const requestPage = options.page ?? productResultsPage;
    const startedAt = window.performance.now();

    setCheckoutError(null);
    setSearchState((current) => ({
      ...current,
      error: null,
      hasSearched: trimmedQuery.length > 0,
      isLoading: trimmedQuery.length > 0,
      products: trimmedQuery.length > 0 ? current.products : [],
      query: trimmedQuery,
      status: trimmedQuery.length > 0 ? "searching" : "ready"
    }));

    if (!trimmedQuery) {
      return;
    }

    try {
      const response = await searchPosProducts(trimmedQuery, {
        page: requestPage,
        pageSize: PRODUCT_RESULTS_PAGE_SIZE
      });

      if (!response.success || !response.data) {
        setSearchState((current) => ({
          ...current,
          error: response.message,
          hasSearched: true,
          isLoading: false,
          products: [],
          query: trimmedQuery,
          meta: {
            page: requestPage,
            pageSize: PRODUCT_RESULTS_PAGE_SIZE,
            totalItems: 0,
            totalPages: 0
          },
          status: "error"
        }));
        return;
      }

      const exactMatch = resolveExactProductMatch(trimmedQuery, response.data.products);
      const nextStatus = response.data.products.length > 0 ? "found" : "no-match";
      const elapsedMs = window.performance.now() - startedAt;
      const remainingMs = Math.max(0, MIN_SEARCH_LOADING_MS - elapsedMs);

      if (remainingMs > 0) {
        await wait(remainingMs);
      }

      setSearchState({
        catalogCount: response.data.catalogCount,
        error: null,
        hasSearched: true,
        isLoading: false,
        meta: response.data.meta,
        products: response.data.products,
        query: response.data.query,
        status: nextStatus
      });

      if (options.autoAddExactMatch && exactMatch) {
        addProductToCart(exactMatch, {
          announceAdded: true,
          clearScannerAfterAction: true
        });
      }
    } catch {
      const message = "The POS product search service is unavailable.";
      const elapsedMs = window.performance.now() - startedAt;
      const remainingMs = Math.max(0, MIN_SEARCH_LOADING_MS - elapsedMs);

      if (remainingMs > 0) {
        await wait(remainingMs);
      }

      setSearchState((current) => ({
        ...current,
        error: message,
        hasSearched: true,
        isLoading: false,
        products: [],
        query: trimmedQuery,
        meta: {
          page: requestPage,
          pageSize: PRODUCT_RESULTS_PAGE_SIZE,
          totalItems: 0,
          totalPages: 0
        },
        status: "error"
      }));
    }
  }

  function updateLineQuantity(productId: string, delta: number) {
    setCheckoutError(null);
    setCartLines((currentLines) =>
      currentLines
        .map((line) => {
          if (line.product.id !== productId) {
            return line;
          }

          const nextQuantity = Math.min(
            line.product.availableStock,
            Math.max(1, line.quantity + delta)
          );

          return {
            ...line,
            quantity: nextQuantity
          };
        })
        .filter((line) => line.quantity > 0)
    );
  }

  function removeLine(productId: string) {
    setCheckoutError(null);
    setCartLines((currentLines) => currentLines.filter((line) => line.product.id !== productId));
  }

  function clearCart() {
    setCheckoutError(null);
    setReceiptSale(null);
    setCartLines([]);
  }

  async function handleCheckout() {
    if (cartLines.length === 0 || isCheckingOut) {
      return;
    }

    setCheckoutError(null);
    setIsCheckingOut(true);

    try {
      const response = await checkoutPosSale({
        items: cartLines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity
        })),
        paymentMethod: "CASH"
      });

      if (!response.success || !response.data) {
        const message = response.message || "Checkout failed.";
        setCheckoutError(message);
        setSearchState((current) => ({
          ...current,
          error: message,
          status: "error"
        }));
        pushToast({
          message,
          title: "Checkout failed",
          variant: "error"
        });
        return;
      }

      setReceiptSale(response.data.sale);
      setReceiptPrintError(null);
      setIsReceiptDialogOpen(true);
      setCartLines([]);
      clearScannerInput();
      focusScannerInput();

      pushToast({
        message: `Sale ${response.data.sale.saleNumber} was saved successfully.`,
        title: "Sale completed",
        variant: "success"
      });

      if (searchState.query) {
        void handleSearch();
      }
    } catch {
      const message = "The POS checkout service is unavailable.";
      setCheckoutError(message);
      setSearchState((current) => ({
        ...current,
        error: message,
        status: "error"
      }));
      pushToast({
        message,
        title: "Checkout failed",
        variant: "error"
      });
    } finally {
      setIsCheckingOut(false);
    }
  }

  function handleVoidSale() {
    clearCart();
    setSearchState((current) => ({
      ...current,
      error: null,
      status: "ready"
    }));
    clearScannerInput();
    focusScannerInput();
  }

  async function handlePrintReceipt() {
    if (!receiptSale || isPrintingReceipt) {
      return;
    }

    setIsPrintingReceipt(true);
    setReceiptPrintError(null);

    try {
      await waitForMinimumDuration(
        requestReceiptPrint(buildRetailReceiptDataFromSale(receiptSale)),
        450
      );
    } catch {
      setReceiptPrintError("Sale completed, but the receipt could not be printed.");
    } finally {
      setIsPrintingReceipt(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Barcode-first counter"
        title="Point of Sale"
        description="Retail selling workspace for scanner input, product lookup, live cart review, and cash checkout."
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Product search</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    Use a USB barcode scanner or manually search by product name, barcode, or SKU.
                  </p>
                </div>
                <StatusBadge variant={searchBadge.variant}>{searchBadge.label}</StatusBadge>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3 lg:grid-cols-[1fr_180px]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSearch({ autoAddExactMatch: true });
                }}
              >
                <label className="flex h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 shadow-sm focus-within:border-emerald-400 focus-within:bg-white">
                  <ScanBarcode className="h-5 w-5 text-slate-500" aria-hidden="true" />
                  <input
                    aria-label="Scan barcode or search product"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    placeholder="Scan barcode or type product name / SKU"
                    ref={scannerInputRef}
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSearch({ autoAddExactMatch: true });
                      }

                      if (event.key === "Escape" && searchInput) {
                        event.preventDefault();
                        clearScannerInput();
                        focusScannerInput();
                      }
                    }}
                  />
                </label>
                <Button disabled={searchState.isLoading} type="submit" variant="secondary">
                  {searchState.isLoading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="h-4 w-4" aria-hidden="true" />
                  )}
                  Search
                </Button>
              </form>
              {searchState.error ? (
                <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {searchState.error}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Product results</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {searchState.status === "ready"
                      ? "No search yet"
                      : `${searchState.meta.totalItems} match${searchState.meta.totalItems === 1 ? "" : "es"}`}
                  </p>
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Catalog {searchState.catalogCount.toLocaleString()}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {searchState.isLoading ? (
                <LoadingState
                  badge="Searching"
                  helper="Checking the live product catalog for matching barcodes, SKUs, and item names."
                  label="Loading product matches"
                />
              ) : shouldShowNoResults ? (
                <EmptyState description="No match found." icon={PackageSearch} title="No match" />
              ) : searchState.products.length > 0 ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <table className="w-full table-fixed border-collapse text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Barcode / SKU</th>
                          <th className="px-4 py-3 font-medium">Product</th>
                          <th className="px-4 py-3 font-medium">Stock</th>
                          <th className="px-4 py-3 font-medium">Unit price</th>
                          <th className="px-4 py-3 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchState.products.map((product) => {
                          const isOutOfStock = product.availableStock <= 0;

                          return (
                            <tr
                              className={`border-t border-slate-200 transition-colors ${
                                isOutOfStock
                                  ? "bg-slate-50/70 text-slate-400"
                                  : "hover:bg-emerald-50/60"
                              }`}
                              key={product.id}
                            >
                              <td className="px-4 py-3">
                                <button
                                  className="text-left"
                                  disabled={isOutOfStock}
                                  type="button"
                                  onClick={() =>
                                    addProductToCart(product, {
                                      announceAdded: true,
                                      clearScannerAfterAction: true
                                    })
                                  }
                                >
                                  <p className="font-medium text-slate-900">
                                    {product.barcode ?? product.sku}
                                  </p>
                                  <p className="text-xs text-slate-500">{product.sku}</p>
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  className="text-left"
                                  disabled={isOutOfStock}
                                  type="button"
                                  onClick={() =>
                                    addProductToCart(product, {
                                      announceAdded: true,
                                      clearScannerAfterAction: true
                                    })
                                  }
                                >
                                  <p className="font-medium text-slate-900">{product.name}</p>
                                  <p className="text-xs text-slate-500">{product.categoryName}</p>
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge
                                  variant={
                                    isOutOfStock
                                      ? "error"
                                      : product.availableStock <= 5
                                        ? "warning"
                                        : "success"
                                  }
                                >
                                  {isOutOfStock
                                    ? "Out of stock"
                                    : `${product.availableStock} in stock`}
                                </StatusBadge>
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-900">
                                {currencyFormatter.format(Number(product.sellingPrice))}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  disabled={isOutOfStock}
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                  onClick={() =>
                                    addProductToCart(product, {
                                      announceAdded: true,
                                      clearScannerAfterAction: true
                                    })
                                  }
                                >
                                  <Plus className="h-4 w-4" aria-hidden="true" />
                                  Add
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <AppPagination
                    itemLabel="products"
                    onPageChange={(nextPage) => {
                      setProductResultsPage(nextPage);
                      void handleSearch({ page: nextPage });
                    }}
                    page={searchState.meta.page}
                    pageSize={searchState.meta.pageSize}
                    totalItems={searchState.meta.totalItems}
                    totalPages={searchState.meta.totalPages}
                  />
                </div>
              ) : (
                <EmptyState
                  description="Enter a barcode, SKU, or product name to search inventory."
                  icon={PackageSearch}
                  title={searchState.status === "ready" ? "No search yet" : "No match"}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Current sale</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Live cart, quantity controls, and checkout.
                </p>
              </div>
              <StatusBadge variant={cartBadge.variant}>{cartBadge.label}</StatusBadge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {receiptSale ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <div className="flex items-start gap-3">
                    <ReceiptText className="mt-0.5 h-4 w-4" aria-hidden="true" />
                    <div>
                      <p className="font-medium">Sale {receiptSale.saleNumber} completed.</p>
                      <p className="mt-1 text-emerald-800">
                        Total {currencyFormatter.format(Number(receiptSale.totalAmount))} has been
                        saved and inventory has been updated.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {checkoutError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {checkoutError}
                </div>
              ) : null}

              {cartLines.length === 0 ? (
                <EmptyState
                  description="Add a product from the results table to build the current sale."
                  icon={ReceiptText}
                  title="No items in cart"
                />
              ) : (
                <div className="space-y-3">
                  <div className="space-y-3">
                    {cartLines.map((line) => (
                      <div
                        className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                        key={line.product.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {line.product.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {line.product.barcode ?? line.product.sku}
                            </p>
                          </div>
                          <Button
                            aria-label={`Remove ${line.product.name}`}
                            className="text-slate-500"
                            size="icon"
                            type="button"
                            variant="ghost"
                            onClick={() => removeLine(line.product.id)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>

                        <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
                          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                            <Button
                              aria-label={`Decrease quantity for ${line.product.name}`}
                              disabled={line.quantity <= 1}
                              size="icon"
                              type="button"
                              variant="ghost"
                              onClick={() => updateLineQuantity(line.product.id, -1)}
                            >
                              <Minus className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <span className="min-w-10 text-center text-sm font-semibold text-slate-900">
                              {line.quantity}
                            </span>
                            <Button
                              aria-label={`Increase quantity for ${line.product.name}`}
                              disabled={line.quantity >= line.product.availableStock}
                              size="icon"
                              type="button"
                              variant="ghost"
                              onClick={() => updateLineQuantity(line.product.id, 1)}
                            >
                              <Plus className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>

                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                              Line total
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-950">
                              {currencyFormatter.format(
                                Number(line.product.sellingPrice) * line.quantity
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-between text-xs text-slate-500">
                          <span>
                            Unit {currencyFormatter.format(Number(line.product.sellingPrice))}
                          </span>
                          <span>Available {line.product.availableStock}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Items</span>
                      <span className="font-medium text-slate-950">{cartSummary.itemCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-medium text-slate-950">
                        {currencyFormatter.format(cartSummary.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold">
                      <span>Total</span>
                      <span>{currencyFormatter.format(cartSummary.total)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                      disabled={cartLines.length === 0 || isCheckingOut}
                      type="button"
                      onClick={() => void handleCheckout()}
                    >
                      {isCheckingOut ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      Cash
                    </Button>
                    <Button
                      disabled={cartLines.length === 0 || isCheckingOut}
                      type="button"
                      variant="danger"
                      onClick={handleVoidSale}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Void
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <RetailReceiptDialog
        error={receiptPrintError}
        isPrinting={isPrintingReceipt}
        open={isReceiptDialogOpen}
        receipt={receiptSale ? buildRetailReceiptDataFromSale(receiptSale) : null}
        onOpenChange={(open) => {
          setIsReceiptDialogOpen(open);

          if (!open) {
            setReceiptSale(null);
            setReceiptPrintError(null);
          }
        }}
        onPrint={() => void handlePrintReceipt()}
        title="Sale receipt"
      />
    </>
  );
}
