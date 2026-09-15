import {
  LoaderCircle,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  ReceiptText,
  ScanBarcode,
  Search,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CashPaymentDialog } from "@/components/pos/CashPaymentDialog";
import { RetailReceiptDialog } from "@/components/receipt/RetailReceiptDialog";
import { AppPagination } from "@/components/shared/AppPagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/ToastProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestAutomaticReceiptPrint, requestReceiptPrint } from "@/services/receiptPrint";
import { checkoutPosSale, searchPosProducts } from "@/services/posService";
import type { PosProduct, PosSale } from "@/types/pos";
import { buildRetailReceiptDataFromSale } from "@/utils/receipt";
import { wait } from "@/utils/timing";

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

type ReceiptPrintStatus = "idle" | "printing" | "printed" | "manual" | "error";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const PRODUCT_RESULTS_PAGE_SIZE = 10;
const MIN_SEARCH_LOADING_MS = 200;

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

export function PosPage() {
  const [searchState, setSearchState] = useState<SearchState>(initialSearchState);
  const [searchInput, setSearchInput] = useState("");
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [productResultsPage, setProductResultsPage] = useState(1);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCashDialogOpen, setIsCashDialogOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<PosSale | null>(null);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [receiptPrintError, setReceiptPrintError] = useState<string | null>(null);
  const [receiptPrintStatus, setReceiptPrintStatus] = useState<ReceiptPrintStatus>("idle");
  const [lastTouchedProductId, setLastTouchedProductId] = useState<string | null>(null);

  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const cartLinesRef = useRef<CartLine[]>([]);
  const cartItemRefs = useRef(new Map<string, HTMLDivElement>());
  const { pushToast } = useToast();

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
    const rafId = window.requestAnimationFrame(() => {
      scannerInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const handleWindowFocus = () => {
      if (!isCashDialogOpen && !isReceiptDialogOpen) {
        focusScannerInput();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [isCashDialogOpen, isReceiptDialogOpen]);

  useEffect(() => {
    setProductResultsPage(1);
  }, [searchState.query]);

  useEffect(() => {
    if (!lastTouchedProductId) return;

    const frame = window.requestAnimationFrame(() => {
      cartItemRefs.current.get(lastTouchedProductId)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });
    const timeout = window.setTimeout(() => setLastTouchedProductId(null), 700);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [cartLines, lastTouchedProductId]);

  const searchBadge =
    searchState.status === "searching"
      ? { label: "Searching", variant: "info" as const }
      : searchState.status === "error"
        ? { label: "Error", variant: "error" as const }
        : searchState.status === "found"
          ? { label: "Found", variant: "success" as const }
          : searchState.status === "no-match"
            ? { label: "No match", variant: "warning" as const }
            : { label: "USB scanner ready", variant: "info" as const };

  const cartBadge = isCheckingOut
    ? { label: "Processing", variant: "info" as const }
    : checkoutError
      ? { label: "Error", variant: "error" as const }
      : cartLines.length > 0
        ? { label: "Active", variant: "success" as const }
        : { label: "Empty", variant: "warning" as const };

  function focusScannerInput() {
    window.requestAnimationFrame(() => {
      scannerInputRef.current?.focus({ preventScroll: true });
    });
  }

  function commitCartLines(nextLines: CartLine[]) {
    cartLinesRef.current = nextLines;
    setCartLines(nextLines);
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
      setCheckoutError(`${product.name} is out of stock.`);
      return false;
    }

    const currentLines = cartLinesRef.current;
    const existingLine = currentLines.find((line) => line.product.id === product.id);

    if (existingLine && existingLine.quantity >= product.availableStock) {
      setCheckoutError(`Only ${product.availableStock} units are available for ${product.name}.`);
      focusScannerInput();
      return false;
    }

    const nextLines = existingLine
      ? currentLines.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
        )
      : [...currentLines, { product, quantity: 1 }];

    setCheckoutError(null);
    commitCartLines(nextLines);
    setLastTouchedProductId(product.id);

    if (options.clearScannerAfterAction !== false) {
      clearScannerInput();
      focusScannerInput();
    }

    if (options.announceAdded) {
      pushToast({
        message: `${product.name} added to the current sale.`,
        title: "Product added",
        variant: "success"
      });
    }

    return true;
  }

  async function handleSearch(options: { autoAddExactMatch?: boolean; page?: number } = {}) {
    const trimmedQuery = searchInput.trim();
    const requestPage = options.page ?? productResultsPage;
    const startedAt = window.performance.now();

    setCheckoutError(null);

    if (!trimmedQuery) {
      setSearchState(initialSearchState);
      focusScannerInput();
      return;
    }

    if (options.autoAddExactMatch) {
      clearScannerInput();
      focusScannerInput();
    }

    setSearchState((current) => ({
      ...current,
      error: null,
      hasSearched: true,
      isLoading: true,
      query: trimmedQuery,
      status: "searching"
    }));

    try {
      const response = await searchPosProducts(trimmedQuery, {
        page: requestPage,
        pageSize: PRODUCT_RESULTS_PAGE_SIZE
      });
      const remainingMs = Math.max(
        0,
        MIN_SEARCH_LOADING_MS - (window.performance.now() - startedAt)
      );

      if (remainingMs > 0) await wait(remainingMs);

      if (!response.success || !response.data) {
        setSearchState((current) => ({
          ...current,
          error: response.message,
          isLoading: false,
          products: [],
          status: "error"
        }));
        focusScannerInput();
        return;
      }

      const exactMatch = resolveExactProductMatch(trimmedQuery, response.data.products);

      setSearchState({
        catalogCount: response.data.catalogCount,
        error: null,
        hasSearched: true,
        isLoading: false,
        meta: response.data.meta,
        products: response.data.products,
        query: response.data.query,
        status: response.data.products.length > 0 ? "found" : "no-match"
      });

      if (options.autoAddExactMatch && exactMatch) {
        addProductToCart(exactMatch, {
          announceAdded: false,
          clearScannerAfterAction: true
        });
      } else {
        focusScannerInput();
      }
    } catch {
      const remainingMs = Math.max(
        0,
        MIN_SEARCH_LOADING_MS - (window.performance.now() - startedAt)
      );
      if (remainingMs > 0) await wait(remainingMs);

      setSearchState((current) => ({
        ...current,
        error: "The POS product search service is unavailable.",
        isLoading: false,
        products: [],
        status: "error"
      }));
      focusScannerInput();
    }
  }

  function updateLineQuantity(productId: string, delta: number) {
    setCheckoutError(null);
    const nextLines = cartLinesRef.current.map((line) => {
      if (line.product.id !== productId) return line;

      return {
        ...line,
        quantity: Math.min(line.product.availableStock, Math.max(1, line.quantity + delta))
      };
    });

    commitCartLines(nextLines);
    setLastTouchedProductId(productId);
    focusScannerInput();
  }

  function removeLine(productId: string) {
    setCheckoutError(null);
    commitCartLines(cartLinesRef.current.filter((line) => line.product.id !== productId));
    cartItemRefs.current.delete(productId);
    focusScannerInput();
  }

  function handleVoidSale() {
    setCheckoutError(null);
    commitCartLines([]);
    setSearchState(initialSearchState);
    clearScannerInput();
    focusScannerInput();
  }

  function openCashPayment() {
    if (cartLines.length === 0 || isCheckingOut) return;
    setCheckoutError(null);
    setIsCashDialogOpen(true);
  }

  async function handleCheckout(cashReceived: string) {
    if (cartLines.length === 0 || isCheckingOut) return;

    setCheckoutError(null);
    setIsCheckingOut(true);

    try {
      const response = await checkoutPosSale({
        cashReceived,
        items: cartLines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity
        })),
        paymentMethod: "CASH"
      });

      if (!response.success || !response.data) {
        setCheckoutError(response.message || "Checkout failed.");
        return;
      }

      const sale = response.data.sale;
      setReceiptSale(sale);
      setReceiptPrintError(null);
      setReceiptPrintStatus("idle");
      setIsCashDialogOpen(false);
      commitCartLines([]);
      setSearchState(initialSearchState);
      clearScannerInput();
      focusScannerInput();

      pushToast({
        message: `Change ${currencyFormatter.format(Number(sale.change))}. Receipt is ready.`,
        title: `Sale ${sale.saleNumber} completed`,
        variant: "success"
      });

      void handleAutomaticPrint(sale);
    } catch {
      setCheckoutError("The POS checkout service is unavailable.");
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function handleAutomaticPrint(sale: PosSale) {
    setIsPrintingReceipt(true);
    setReceiptPrintStatus("printing");
    setReceiptPrintError(null);

    try {
      const printed = await requestAutomaticReceiptPrint(buildRetailReceiptDataFromSale(sale));

      if (printed) {
        setReceiptPrintStatus("printed");
        pushToast({
          message: `Receipt ${sale.saleNumber} was sent to the receipt printer.`,
          title: "Receipt printed",
          variant: "success"
        });
      } else {
        setReceiptPrintStatus("manual");
      }
    } catch {
      setReceiptPrintStatus("error");
      setReceiptPrintError(
        "Sale completed, but automatic receipt printing failed. Reprint is available."
      );
      pushToast({
        message: "The sale is safe, but the receipt printer did not complete the print request.",
        title: "Receipt print failed",
        variant: "error"
      });
    } finally {
      setIsPrintingReceipt(false);
    }
  }

  async function handlePrintReceipt() {
    if (!receiptSale || isPrintingReceipt) return;

    setIsPrintingReceipt(true);
    setReceiptPrintError(null);

    try {
      await requestReceiptPrint(buildRetailReceiptDataFromSale(receiptSale));
      setReceiptPrintStatus("printed");
    } catch {
      setReceiptPrintStatus("error");
      setReceiptPrintError("The receipt could not be printed. The completed sale is unchanged.");
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

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Product search</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    USB barcode scanners work as keyboard input. Plug in the scanner and scan; no
                    pairing step is required.
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
                <label className="flex h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 shadow-sm focus-within:border-indigo-400 focus-within:bg-white">
                  <ScanBarcode className="h-5 w-5 text-slate-500" aria-hidden="true" />
                  <input
                    ref={scannerInputRef}
                    aria-label="Scan barcode or search product"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    placeholder="Scan barcode or search name / SKU / price"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSearch({ autoAddExactMatch: true });
                        return;
                      }

                      if (event.key === "Escape") {
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
                  helper="Checking the live catalog for matching barcodes, SKUs, prices, and product names."
                  label="Loading product matches"
                />
              ) : searchState.status === "no-match" ? (
                <EmptyState description="No match found." icon={PackageSearch} title="No match" />
              ) : searchState.products.length > 0 ? (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-md border border-slate-200">
                    <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Barcode / SKU</th>
                          <th className="px-4 py-3 font-medium">Product</th>
                          <th className="px-4 py-3 font-medium">Stock</th>
                          <th className="px-4 py-3 font-medium">Unit price</th>
                          <th className="px-4 py-3 text-right font-medium">Action</th>
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
                                  : "hover:bg-indigo-50/50"
                              }`}
                              key={product.id}
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">
                                  {product.barcode ?? product.sku}
                                </p>
                                <p className="text-xs text-slate-500">{product.sku}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{product.name}</p>
                                <p className="text-xs text-slate-500">{product.categoryName}</p>
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
                  description="Scan a barcode or enter a SKU, product name, or price to search inventory."
                  icon={PackageSearch}
                  title="Scanner ready"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm xl:sticky xl:top-4 xl:flex xl:h-[calc(100vh-11rem)] xl:min-h-[560px] xl:flex-col">
          <CardHeader className="shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Current sale</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  {cartSummary.itemCount > 0
                    ? `${cartSummary.itemCount} item${cartSummary.itemCount === 1 ? "" : "s"} scanned`
                    : "Ready for the next barcode scan."}
                </p>
              </div>
              <StatusBadge variant={cartBadge.variant}>{cartBadge.label}</StatusBadge>
            </div>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col">
            {receiptSale ? (
              <div className="mb-3 shrink-0 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <div className="flex items-start gap-2">
                  <ReceiptText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">Last sale: {receiptSale.saleNumber}</p>
                    <p className="mt-1 text-emerald-800">
                      Change {currencyFormatter.format(Number(receiptSale.change))}
                      {receiptPrintStatus === "printed" ? " · Receipt printed" : " · Receipt ready"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => setIsReceiptDialogOpen(true)}
                      >
                        <ReceiptText className="h-4 w-4" aria-hidden="true" />
                        View receipt
                      </Button>
                      <Button
                        disabled={isPrintingReceipt}
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => void handlePrintReceipt()}
                      >
                        {isPrintingReceipt ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Printer className="h-4 w-4" aria-hidden="true" />
                        )}
                        Reprint
                      </Button>
                    </div>
                  </div>
                </div>
                {receiptPrintError ? (
                  <p className="mt-2 text-xs font-medium text-amber-800">{receiptPrintError}</p>
                ) : null}
              </div>
            ) : null}

            {checkoutError ? (
              <div className="mb-3 shrink-0 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {checkoutError}
              </div>
            ) : null}

            {cartLines.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <EmptyState
                  description="Scan a product barcode to start the current sale."
                  icon={ReceiptText}
                  title="No items in cart"
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {cartLines.map((line) => (
                    <div
                      ref={(node) => {
                        if (node) cartItemRefs.current.set(line.product.id, node);
                        else cartItemRefs.current.delete(line.product.id);
                      }}
                      className={`rounded-md border bg-white p-4 shadow-sm transition-colors ${
                        lastTouchedProductId === line.product.id
                          ? "border-indigo-300 bg-indigo-50/60"
                          : "border-slate-200"
                      }`}
                      data-product-id={line.product.id}
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

                <div className="shrink-0 border-t border-slate-200 bg-white pt-3">
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

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Button disabled={isCheckingOut} type="button" onClick={openCashPayment}>
                      Cash · {currencyFormatter.format(cartSummary.total)}
                    </Button>
                    <Button
                      disabled={isCheckingOut}
                      type="button"
                      variant="danger"
                      onClick={handleVoidSale}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Void
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <CashPaymentDialog
        error={checkoutError}
        isSubmitting={isCheckingOut}
        open={isCashDialogOpen}
        total={cartSummary.total}
        onConfirm={(cashReceived) => void handleCheckout(cashReceived)}
        onOpenChange={(open) => {
          setIsCashDialogOpen(open);
          if (!open) focusScannerInput();
        }}
      />

      <RetailReceiptDialog
        error={receiptPrintError}
        isPrinting={isPrintingReceipt}
        open={isReceiptDialogOpen}
        receipt={receiptSale ? buildRetailReceiptDataFromSale(receiptSale) : null}
        onOpenChange={(open) => {
          setIsReceiptDialogOpen(open);
          if (!open) focusScannerInput();
        }}
        onPrint={() => void handlePrintReceipt()}
        title="Sale receipt"
      />
    </>
  );
}
