import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  PackageCheck,
  ScanBarcode,
  Search
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchProductById, fetchProducts, type ProductRecord } from "@/services/catalogApi";
import {
  receiveInventoryStock,
  type ReceivingBarcodeErrorDetails,
  type ReceivingStockInput
} from "@/services/receivingApi";

const SEARCH_DEBOUNCE_MS = 300;

type PendingBarcodeConfirmation = {
  barcode: string;
  details?: ReceivingBarcodeErrorDetails;
};

export function ReceivingPage() {
  const { pushToast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [quantity, setQuantity] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [noExpirationDate, setNoExpirationDate] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictDetails, setConflictDetails] = useState<ReceivingBarcodeErrorDetails | null>(null);
  const [barcodeConfirmation, setBarcodeConfirmation] =
    useState<PendingBarcodeConfirmation | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    setLoadingProducts(true);

    void fetchProducts({ search: search || undefined, page: 1, pageSize: 12 })
      .then((result) => {
        if (requestId === requestRef.current) setProducts(result.items);
      })
      .catch(() => {
        if (requestId === requestRef.current) setProducts([]);
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoadingProducts(false);
      });
  }, [search]);

  function chooseProduct(product: ProductRecord) {
    if (pending) return;
    setSelectedProduct(product);
    resetReceiptFields();
  }

  function resetReceiptFields() {
    setQuantity("");
    setBatchCode("");
    setExpiresAt("");
    setNoExpirationDate(false);
    setBarcodeInput("");
    setError(null);
    setConflictDetails(null);
    setBarcodeConfirmation(null);
  }

  function validateReceipt(): ReceivingStockInput | null {
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      setError("Quantity must be a positive whole number.");
      return null;
    }

    const normalizedBatchCode = batchCode.trim();
    if (!normalizedBatchCode) {
      setError("Batch/Lot number is required.");
      return null;
    }

    return {
      quantity: parsedQuantity,
      batchCode: normalizedBatchCode,
      expiresAt: noExpirationDate || !expiresAt ? null : expiresAt,
      ...(barcodeInput.trim() ? { scannedBarcode: barcodeInput.trim() } : {})
    };
  }

  async function commitReceipt(confirmNewBarcode: boolean) {
    if (!selectedProduct || pending) return false;
    const input = validateReceipt();
    if (!input) return false;

    setPending(true);
    setError(null);
    setConflictDetails(null);

    try {
      const response = await receiveInventoryStock(selectedProduct.id, {
        ...input,
        confirmNewBarcode
      });

      if (!response.success) {
        const code = response.error?.code;
        const details = response.error?.details;

        if (code === "PRODUCT_BARCODE_CONFIRMATION_REQUIRED") {
          setBarcodeConfirmation({
            barcode: details?.barcode ?? barcodeInput.trim(),
            details
          });
          return false;
        }

        if (code === "PRODUCT_BARCODE_CONFLICT") {
          setBarcodeConfirmation(null);
          setConflictDetails(details ?? null);
          setError("This barcode already belongs to another product and cannot be reassigned.");
          return false;
        }

        if (code === "PRODUCT_INTERNAL_BARCODE_RESERVED") {
          setBarcodeConfirmation(null);
          setError("Unknown YSB internal barcodes cannot be enrolled during receiving.");
          return false;
        }

        setBarcodeConfirmation(null);
        setError(response.message || "Unable to receive stock.");
        return false;
      }

      if (!response.data) {
        setBarcodeConfirmation(null);
        setError("The receiving service did not return the updated inventory record.");
        return false;
      }

      const refreshed = await fetchProductById(selectedProduct.id).catch(() => null);
      if (refreshed) setSelectedProduct(refreshed);

      pushToast({
        title: "Stock received",
        message: input.scannedBarcode
          ? "Inventory was updated and the scanned barcode identity is verified."
          : "Inventory and batch quantities were updated successfully.",
        variant: "success"
      });

      resetReceiptFields();
      return true;
    } catch (requestError) {
      setBarcodeConfirmation(null);
      setError(
        requestError instanceof Error ? requestError.message : "Unable to reach the receiving service."
      );
      return false;
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void commitReceipt(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="INVENTORY"
        title="Receiving"
        description="Receive incoming stock against one canonical product. Known barcodes pass immediately; unknown manufacturer barcodes require one explicit registration confirmation."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Select product</h2>
              <p className="mt-1 text-sm text-slate-600">
                Search by product name, SKU, or any registered barcode.
              </p>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                aria-label="Search receiving products"
                className="pl-9"
                placeholder="Search products..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {loadingProducts ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading products...
                </div>
              ) : products.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No matching products"
                  description="Try another product name, SKU, or registered barcode."
                />
              ) : (
                products.map((product) => {
                  const selected = selectedProduct?.id === product.id;
                  return (
                    <button
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selected
                          ? "border-emerald-300 bg-emerald-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                      }`}
                      key={product.id}
                      type="button"
                      onClick={() => chooseProduct(product)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{product.name}</p>
                          <p className="mt-1 text-xs text-slate-500">SKU: {product.sku}</p>
                          <p className="mt-1 break-all text-xs text-slate-500">
                            Primary barcode: {product.barcode ?? "Not set"}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {product.inventory.currentQuantity} on hand
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            {!selectedProduct ? (
              <div className="py-16">
                <EmptyState
                  icon={PackageCheck}
                  title="Choose the product being received"
                  description="The selected canonical product anchors barcode enrollment, batch creation, and stock movement."
                />
              </div>
            ) : (
              <form className="space-y-5" onSubmit={submit}>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{selectedProduct.name}</p>
                      <p className="mt-1 text-xs text-slate-500">SKU: {selectedProduct.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">On hand</p>
                      <p className="mt-1 text-xl font-semibold text-slate-950">
                        {selectedProduct.inventory.currentQuantity}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiving-barcode">Barcode on received item</Label>
                  <div className="relative">
                    <ScanBarcode
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <Input
                      id="receiving-barcode"
                      autoComplete="off"
                      className="pl-9 font-mono"
                      placeholder="Scan or enter barcode (optional)"
                      value={barcodeInput}
                      onChange={(event) => {
                        setBarcodeInput(event.target.value);
                        setBarcodeConfirmation(null);
                        setConflictDetails(null);
                        setError(null);
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Manufacturer UPC/EAN/GTIN or existing YSB label. No fixed digit length is assumed.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="receiving-quantity">Quantity</Label>
                    <Input
                      id="receiving-quantity"
                      inputMode="numeric"
                      placeholder="0"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receiving-batch">Batch/Lot number</Label>
                    <Input
                      id="receiving-batch"
                      placeholder="Batch or lot code"
                      value={batchCode}
                      onChange={(event) => setBatchCode(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiving-expiry">Expiration date</Label>
                  <Input
                    id="receiving-expiry"
                    disabled={noExpirationDate}
                    type="date"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      checked={noExpirationDate}
                      className="h-4 w-4 rounded border-slate-300"
                      type="checkbox"
                      onChange={(event) => {
                        setNoExpirationDate(event.target.checked);
                        if (event.target.checked) setExpiresAt("");
                      }}
                    />
                    No expiration date
                  </label>
                </div>

                {barcodeConfirmation ? (
                  <Alert>
                    <CircleAlert className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>New barcode detected</AlertTitle>
                    <AlertDescription>
                      <div className="space-y-3">
                        <p>
                          <span className="font-mono font-semibold">{barcodeConfirmation.barcode}</span>{" "}
                          is not yet registered.
                        </p>
                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Current product
                          </p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedProduct.name}</p>
                          <p className="mt-1 text-xs text-slate-500">SKU: {selectedProduct.sku}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={pending}
                            type="button"
                            onClick={() => void commitReceipt(true)}
                          >
                            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                            Register barcode & receive
                          </Button>
                          <Button
                            disabled={pending}
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setBarcodeConfirmation(null);
                              setBarcodeInput("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}

                {error ? (
                  <Alert variant="destructive">
                    <CircleAlert className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>Receiving blocked</AlertTitle>
                    <AlertDescription>
                      <p>{error}</p>
                      {conflictDetails?.existingProductName ? (
                        <p className="mt-2">
                          Existing product: <strong>{conflictDetails.existingProductName}</strong>
                          {conflictDetails.existingProductSku
                            ? ` (${conflictDetails.existingProductSku})`
                            : ""}
                        </p>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ) : null}

                {!barcodeConfirmation ? (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                    <Button
                      disabled={pending}
                      type="button"
                      variant="secondary"
                      onClick={resetReceiptFields}
                    >
                      Clear
                    </Button>
                    <Button disabled={pending} type="submit">
                      {pending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <PackageCheck className="h-4 w-4" aria-hidden="true" />
                      )}
                      {pending ? "Receiving..." : "Receive stock"}
                    </Button>
                  </div>
                ) : null}

                {!error && !barcodeConfirmation && barcodeInput.trim() ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    Known barcodes receive immediately. Unknown barcodes stop before any stock change and ask once for confirmation.
                  </div>
                ) : null}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
