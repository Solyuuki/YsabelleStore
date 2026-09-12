import {
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileText,
  Link2,
  LoaderCircle,
  PackageSearch,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from "react";
import { useNavigate } from "react-router-dom";

import { AppPagination } from "@/components/shared/AppPagination";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/ToastProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchProducts,
  lookupInventoryByBarcode,
  previewInventoryStockImport,
  type InventoryImportPreview
} from "@/services/catalogApi";
import {
  completeBulkDeliverySession,
  type BulkDeliverySessionResult
} from "@/services/bulkDeliveryApi";
import { listRestockOrders, type RestockOrder } from "@/services/restockApi";
import { formatFileSize, getImportFileType } from "@/utils/importFormatting";
import { waitForMinimumDuration } from "@/utils/timing";

const PREVIEW_MINIMUM_MS = 450;
const IMPORT_MINIMUM_MS = 550;
const MAX_FILE_SIZE_MB = 20;
const DELIVERY_PAGE_SIZE = 10;
const RECEIVABLE_STATUSES = ["AWAITING_DELIVERY", "PARTIALLY_RECEIVED"] as const;

type ImportMode = "SPREADSHEET" | "PDF";
type Phase =
  | "idle"
  | "file-ready"
  | "previewing"
  | "preview-ready"
  | "importing"
  | "success"
  | "error";

type ProductOption = {
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
};

type DeliveryRow = ProductOption & {
  rowId: string;
  restockOrderLineId: string | null;
  expectedQuantity: number | null;
  previouslyReceived: number;
  remainingQuantity: number | null;
  deliveredQuantity: string;
  damagedQuantity: string;
  damageReason: string;
  batchCode: string;
  expiresAt: string;
  noExpiration: boolean;
  confirmOverDelivery: boolean;
  reason: string | null;
};

function wholeNumber(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

function fileExtension(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

function optionFromProduct(product: {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
}): ProductOption {
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    barcode: product.barcode
  };
}

function acceptedForRow(row: DeliveryRow) {
  const delivered = Math.max(0, wholeNumber(row.deliveredQuantity));
  const damaged = Math.max(0, wholeNumber(row.damagedQuantity));
  return Math.max(0, delivered - damaged);
}

function missingForRow(row: DeliveryRow) {
  if (row.remainingQuantity === null) return 0;
  return Math.max(0, row.remainingQuantity - Math.max(0, wholeNumber(row.deliveredQuantity)));
}

function makeRestockRows(order: RestockOrder): DeliveryRow[] {
  return order.lines
    .filter((line) => line.isSelected)
    .map((line) => {
      const remaining = Math.max(0, line.requestedQuantity - line.receivedQuantity);
      return {
        productId: line.product.id,
        productName: line.product.name,
        sku: line.product.sku,
        barcode: line.product.barcode,
        rowId: line.id,
        restockOrderLineId: line.id,
        expectedQuantity: line.requestedQuantity,
        previouslyReceived: line.receivedQuantity,
        remainingQuantity: remaining,
        deliveredQuantity: "0",
        damagedQuantity: "0",
        damageReason: "",
        batchCode: "",
        expiresAt: "",
        noExpiration: false,
        confirmOverDelivery: false,
        reason: null
      };
    })
    .filter((row) => (row.remainingQuantity ?? 0) > 0);
}

function makeStandalonePreviewRows(preview: InventoryImportPreview): DeliveryRow[] {
  return preview.rows.flatMap((row) => {
    if (!row.valid || !row.productId || !row.productName || !row.deliveryData) return [];
    return [
      {
        productId: row.productId,
        productName: row.productName,
        sku: row.deliveryData.sku ?? "",
        barcode: row.deliveryData.barcode,
        rowId: `preview-${row.rowNumber}`,
        restockOrderLineId: null,
        expectedQuantity: null,
        previouslyReceived: 0,
        remainingQuantity: null,
        deliveredQuantity: String(row.deliveryData.quantity),
        damagedQuantity: "0",
        damageReason: "",
        batchCode: row.deliveryData.batchCode,
        expiresAt: row.deliveryData.expirationDate ?? "",
        noExpiration: row.deliveryData.expirationDate === null,
        confirmOverDelivery: false,
        reason: row.deliveryData.reason
      }
    ];
  });
}

function mergePreviewIntoRestock(order: RestockOrder, preview: InventoryImportPreview) {
  const baseRows = makeRestockRows(order);
  const byProduct = new Map<string, NonNullable<InventoryImportPreview["rows"][number]>>();
  const duplicateProductIds = new Set<string>();

  preview.rows.forEach((row) => {
    if (!row.valid || !row.productId || !row.deliveryData) return;
    if (byProduct.has(row.productId)) duplicateProductIds.add(row.productId);
    else byProduct.set(row.productId, row);
  });

  const orderProductIds = new Set(baseRows.map((row) => row.productId));
  let unmatchedRows = 0;
  preview.rows.forEach((row) => {
    if (row.valid && row.productId && !orderProductIds.has(row.productId)) unmatchedRows += 1;
  });
  unmatchedRows += duplicateProductIds.size;

  const rows = baseRows.map((row) => {
    const source = byProduct.get(row.productId);
    if (!source?.deliveryData || duplicateProductIds.has(row.productId)) return row;

    return {
      ...row,
      deliveredQuantity: String(source.deliveryData.quantity),
      batchCode: source.deliveryData.batchCode,
      expiresAt: source.deliveryData.expirationDate ?? "",
      noExpiration: source.deliveryData.expirationDate === null,
      reason: source.deliveryData.reason
    };
  });

  return { rows, unmatchedRows };
}

export function InventoryImportDialog({
  open,
  onClose,
  onImported,
  triggerRef
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef(0);
  const [mode, setMode] = useState<ImportMode>("SPREADSHEET");
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<InventoryImportPreview | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<BulkDeliverySessionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<RestockOrder | null>(null);
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketResults, setTicketResults] = useState<RestockOrder[]>([]);
  const [searchingTickets, setSearchingTickets] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [unmatchedRows, setUnmatchedRows] = useState(0);
  const [page, setPage] = useState(1);

  const isPreviewing = phase === "previewing";
  const isImporting = phase === "importing";
  const isBusy = isPreviewing || isImporting;
  const hasSpreadsheetPreview = mode === "SPREADSHEET" && phase === "preview-ready" && preview;
  const visibleIssues = useMemo(() => preview?.errors.slice(0, 6) ?? [], [preview]);

  const review = useMemo(() => {
    let missingExpiry = 0;
    let invalidQuantity = 0;
    let missingBatch = 0;
    let missingDamageReason = 0;
    let overDelivery = 0;
    let discrepancies = 0;

    rows.forEach((row) => {
      const delivered = wholeNumber(row.deliveredQuantity);
      const damaged = wholeNumber(row.damagedQuantity);
      const accepted = acceptedForRow(row);

      if (delivered < 0 || damaged < 0 || damaged > Math.max(0, delivered)) invalidQuantity += 1;
      if (accepted > 0 && row.batchCode.trim().length === 0) missingBatch += 1;
      if (accepted > 0 && !row.noExpiration && row.expiresAt.trim().length === 0) missingExpiry += 1;
      if (damaged > 0 && row.damageReason.trim().length < 3) missingDamageReason += 1;
      if (
        row.remainingQuantity !== null &&
        accepted > row.remainingQuantity &&
        !row.confirmOverDelivery
      ) {
        overDelivery += 1;
      }
      if (
        row.remainingQuantity !== null &&
        (delivered !== row.remainingQuantity || damaged > 0)
      ) {
        discrepancies += 1;
      }
    });

    const unresolved = (preview?.invalidRows ?? 0) + unmatchedRows;
    const blockingIssues =
      invalidQuantity + missingBatch + missingExpiry + missingDamageReason + overDelivery + unresolved;
    const deliveredUnits = rows.reduce(
      (sum, row) => sum + Math.max(0, wholeNumber(row.deliveredQuantity)),
      0
    );
    const acceptedUnits = rows.reduce((sum, row) => sum + acceptedForRow(row), 0);
    const damagedUnits = rows.reduce(
      (sum, row) => sum + Math.max(0, wholeNumber(row.damagedQuantity)),
      0
    );
    const missingUnits = rows.reduce((sum, row) => sum + missingForRow(row), 0);

    return {
      totalLines: rows.length,
      discrepancies,
      missingExpiry,
      unresolved,
      blockingIssues,
      deliveredUnits,
      acceptedUnits,
      damagedUnits,
      missingUnits
    };
  }, [preview, rows, unmatchedRows]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * DELIVERY_PAGE_SIZE;
    return rows.slice(start, start + DELIVERY_PAGE_SIZE);
  }, [page, rows]);

  useEffect(() => {
    if (!open) return;
    resetAll();
  }, [open]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(rows.length / DELIVERY_PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [page, rows.length]);

  function resetAll() {
    requestRef.current += 1;
    setMode("SPREADSHEET");
    setPhase("idle");
    setFile(null);
    setPreview(null);
    setDeliverySummary(null);
    setError(null);
    setIsDragging(false);
    setShowGuide(false);
    setSelectedOrder(null);
    setTicketSearch("");
    setTicketResults([]);
    setTicketError(null);
    setProductSearch("");
    setProductResults([]);
    setProductError(null);
    setRows([]);
    setUnmatchedRows(0);
    setPage(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetMode(nextMode: ImportMode) {
    if (isBusy) return;
    requestRef.current += 1;
    setMode(nextMode);
    setPhase("idle");
    setFile(null);
    setPreview(null);
    setDeliverySummary(null);
    setError(null);
    setIsDragging(false);
    setSelectedOrder(null);
    setTicketSearch("");
    setTicketResults([]);
    setTicketError(null);
    setProductSearch("");
    setProductResults([]);
    setProductError(null);
    setRows([]);
    setUnmatchedRows(0);
    setPage(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function close() {
    if (!isBusy) onClose();
  }

  function getFileValidationError(nextFile: File) {
    const extension = fileExtension(nextFile.name);
    const validExtension =
      mode === "SPREADSHEET" ? extension === "csv" || extension === "xlsx" : extension === "pdf";
    if (!validExtension) {
      return mode === "SPREADSHEET"
        ? "Unsupported file type. Use a CSV or XLSX delivery file."
        : "Unsupported file type. Use a PDF delivery document.";
    }
    if (nextFile.size === 0) return "The selected file is empty.";
    if (nextFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `File exceeds ${MAX_FILE_SIZE_MB} MB.`;
    return null;
  }

  function handleFileSelection(nextFile: File | null) {
    if (!nextFile) return;
    const validationError = getFileValidationError(nextFile);
    requestRef.current += 1;
    setFile(validationError ? null : nextFile);
    setPreview(null);
    setDeliverySummary(null);
    setError(validationError);
    setPhase(validationError ? "error" : "file-ready");
    setUnmatchedRows(0);
    setPage(1);
    if (mode === "SPREADSHEET") {
      setRows(selectedOrder ? makeRestockRows(selectedOrder) : []);
    }
    if (validationError && fileInputRef.current) fileInputRef.current.value = "";
  }

  function openFilePicker() {
    if (isBusy) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!isBusy) handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  }

  async function previewSpreadsheet() {
    if (!file || mode !== "SPREADSHEET" || phase !== "file-ready") return;
    const sessionId = ++requestRef.current;
    setPhase("previewing");
    setError(null);
    try {
      const response = await waitForMinimumDuration(
        previewInventoryStockImport(file),
        PREVIEW_MINIMUM_MS
      );
      if (sessionId !== requestRef.current) return;
      if (!response.success || !response.data) {
        setPhase("file-ready");
        setError(response.message || "Delivery preview failed.");
        return;
      }
      setPreview(response.data);
      if (selectedOrder) {
        const merged = mergePreviewIntoRestock(selectedOrder, response.data);
        setRows(merged.rows);
        setUnmatchedRows(merged.unmatchedRows);
      } else {
        setRows(makeStandalonePreviewRows(response.data));
        setUnmatchedRows(0);
      }
      setPage(1);
      setPhase("preview-ready");
    } catch (previewError) {
      if (sessionId !== requestRef.current) return;
      setPhase("file-ready");
      setError(previewError instanceof Error ? previewError.message : "Delivery preview failed.");
    }
  }

  async function searchRestockTickets() {
    if (searchingTickets) return;
    setSearchingTickets(true);
    setTicketError(null);
    try {
      const result = await listRestockOrders({
        search: ticketSearch.trim() || undefined,
        statuses: RECEIVABLE_STATUSES,
        page: 1,
        pageSize: 8
      });
      setTicketResults(result.items);
      if (result.items.length === 0) setTicketError("No receivable Restock Order matched.");
    } catch (searchError) {
      setTicketResults([]);
      setTicketError(searchError instanceof Error ? searchError.message : "Restock Order search failed.");
    } finally {
      setSearchingTickets(false);
    }
  }

  function selectRestockOrder(order: RestockOrder) {
    setSelectedOrder(order);
    setTicketResults([]);
    setTicketSearch(order.orderNumber);
    setTicketError(null);
    if (preview && mode === "SPREADSHEET") {
      const merged = mergePreviewIntoRestock(order, preview);
      setRows(merged.rows);
      setUnmatchedRows(merged.unmatchedRows);
    } else {
      setRows(makeRestockRows(order));
      setUnmatchedRows(0);
    }
    setPage(1);
  }

  function clearRestockOrder() {
    setSelectedOrder(null);
    setTicketSearch("");
    setTicketResults([]);
    setTicketError(null);
    if (preview && mode === "SPREADSHEET") setRows(makeStandalonePreviewRows(preview));
    else setRows([]);
    setUnmatchedRows(0);
    setPage(1);
  }

  async function searchProducts() {
    const query = productSearch.trim();
    if (!query || searchingProducts || selectedOrder) return;
    setSearchingProducts(true);
    setProductError(null);
    try {
      const [catalogResult, barcodeResult] = await Promise.allSettled([
        fetchProducts({ page: 1, pageSize: 8, search: query }),
        lookupInventoryByBarcode(query)
      ]);
      const options = new Map<string, ProductOption>();
      if (catalogResult.status === "fulfilled") {
        catalogResult.value.items.forEach((product) => options.set(product.id, optionFromProduct(product)));
      }
      if (barcodeResult.status === "fulfilled") {
        const item = barcodeResult.value;
        options.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode
        });
      }
      const results = [...options.values()];
      setProductResults(results);
      if (results.length === 0) {
        setProductError(
          "No canonical Product matched that name, SKU, barcode, or YSB label. Create the Product in Products first, then return and search again."
        );
      }
    } catch (lookupError) {
      setProductResults([]);
      setProductError(lookupError instanceof Error ? lookupError.message : "Product lookup failed.");
    } finally {
      setSearchingProducts(false);
    }
  }

  function addStandalonePdfRow(option: ProductOption) {
    setRows((current) => [
      ...current,
      {
        ...option,
        rowId: crypto.randomUUID(),
        restockOrderLineId: null,
        expectedQuantity: null,
        previouslyReceived: 0,
        remainingQuantity: null,
        deliveredQuantity: "1",
        damagedQuantity: "0",
        damageReason: "",
        batchCode: "",
        expiresAt: "",
        noExpiration: false,
        confirmOverDelivery: false,
        reason: "Bulk delivery receipt from supplier PDF"
      }
    ]);
    setProductResults([]);
    setProductSearch("");
    setProductError(null);
  }

  function updateRow(rowId: string, patch: Partial<DeliveryRow>) {
    setRows((current) => current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  }

  function removeStandaloneRow(rowId: string) {
    setRows((current) => current.filter((row) => row.rowId !== rowId));
  }

  function useExpectedQuantities() {
    if (!selectedOrder) return;
    setRows((current) =>
      current.map((row) => ({
        ...row,
        deliveredQuantity: String(row.remainingQuantity ?? 0),
        damagedQuantity: "0",
        damageReason: "",
        confirmOverDelivery: false
      }))
    );
  }

  function previewPdfDocument() {
    if (!file || mode !== "PDF") return;
    const objectUrl = URL.createObjectURL(file);
    const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
    if (!opened) setError("The browser blocked the PDF preview. Allow pop-ups and try again.");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  async function completeReceipt() {
    if (!file || rows.length === 0 || review.blockingIssues > 0 || review.deliveredUnits === 0) return;
    const sessionId = ++requestRef.current;
    setPhase("importing");
    setError(null);
    try {
      const result = await waitForMinimumDuration(
        completeBulkDeliverySession({
          sourceType: mode === "SPREADSHEET" ? "SPREADSHEET" : "PDF",
          sourceFileName: file.name,
          restockOrderId: selectedOrder?.id ?? null,
          expectedOrderVersion: selectedOrder?.version,
          rows: rows.map((row) => {
            const accepted = acceptedForRow(row);
            const damaged = Math.max(0, wholeNumber(row.damagedQuantity));
            return {
              productId: row.productId,
              restockOrderLineId: row.restockOrderLineId,
              receivedQuantity: Math.max(0, wholeNumber(row.deliveredQuantity)),
              damagedQuantity: selectedOrder ? damaged : 0,
              damageReason: selectedOrder && damaged > 0 ? row.damageReason.trim() : null,
              acceptedQuantity: accepted,
              batchCode: accepted > 0 ? row.batchCode.trim() : null,
              expiresAt: accepted > 0 && !row.noExpiration ? row.expiresAt : null,
              noExpiration: accepted > 0 ? row.noExpiration : false,
              confirmOverDelivery: row.confirmOverDelivery,
              reason: row.reason
            };
          })
        }),
        IMPORT_MINIMUM_MS
      );
      if (sessionId !== requestRef.current) return;
      setDeliverySummary(result);
      setPhase("success");
      await onImported();
      pushToast({
        title: result.restockOrderNumber ? "Restock delivery recorded" : "Bulk receipt completed",
        message: result.restockOrderNumber
          ? `${result.restockOrderNumber}: ${result.totalUnitsAccepted} accepted, ${result.remainingUnits} still pending.`
          : `${result.totalLines} delivery lines and ${result.totalUnitsAccepted} units were received.`,
        variant: "success"
      });
    } catch (receiptError) {
      if (sessionId !== requestRef.current) return;
      setPhase(mode === "SPREADSHEET" && preview ? "preview-ready" : "file-ready");
      setError(receiptError instanceof Error ? receiptError.message : "Receipt completion failed.");
    }
  }

  const accept = mode === "SPREADSHEET" ? ".csv,.xlsx" : ".pdf";
  const dropTitle =
    mode === "SPREADSHEET" ? "Drop an Excel or CSV delivery file here" : "Drop a delivery PDF here";
  const formatLabel = mode === "SPREADSHEET" ? "CSV or XLSX" : "PDF";
  const canPreviewSpreadsheet = mode === "SPREADSHEET" && phase === "file-ready" && Boolean(file);
  const canComplete = Boolean(
    file &&
      rows.length > 0 &&
      review.blockingIssues === 0 &&
      review.deliveredUnits > 0 &&
      !isBusy &&
      (mode === "PDF" || phase === "preview-ready")
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent
        aria-describedby="inventory-bulk-delivery-description"
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[1000px] flex-col overflow-hidden p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef?.current?.focus();
        }}
        onEscapeKeyDown={(event) => isBusy && event.preventDefault()}
        onInteractOutside={(event) => isBusy && event.preventDefault()}
      >
        <DialogHeader className="relative border-b border-slate-200 px-6 py-6 pr-14">
          <DialogClose asChild>
            <Button
              aria-label="Close bulk delivery import"
              className="absolute right-4 top-4"
              disabled={isBusy}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogClose>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <DialogTitle>Import inventory delivery</DialogTitle>
              <Button
                className="h-7 rounded-full px-2.5 text-xs"
                disabled={isBusy}
                onClick={() => setShowGuide((current) => !current)}
                type="button"
                variant="secondary"
              >
                ? Guide
              </Button>
            </div>
            <DialogDescription id="inventory-bulk-delivery-description" className="max-w-3xl">
              Use Excel/CSV or a supplier PDF, optionally link the physical delivery to an existing
              Restock Order, review discrepancies, then complete one validated receipt.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {showGuide ? (
              <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5">
                <p className="text-sm font-semibold text-slate-950">Bulk delivery guide</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Link a Restock Order when this delivery fulfills an approved ticket. That keeps
                  expected, missing, damaged, return-report, and partial-delivery history on the
                  same procurement record. Standalone imports are for accepted stock only.
                </p>
              </section>
            ) : null}

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <Button
                className="justify-center"
                disabled={isBusy}
                onClick={() => resetMode("SPREADSHEET")}
                type="button"
                variant={mode === "SPREADSHEET" ? "default" : "ghost"}
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                Excel / CSV
              </Button>
              <Button
                className="justify-center"
                disabled={isBusy}
                onClick={() => resetMode("PDF")}
                type="button"
                variant={mode === "PDF" ? "default" : "ghost"}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                PDF
              </Button>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Delivery needs attention</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {phase !== "success" ? (
              <div
                className={[
                  "cursor-pointer rounded-2xl border border-dashed p-7 text-center transition-colors",
                  isDragging ? "border-violet-600 bg-violet-100" : "border-violet-300 bg-violet-50/70",
                  isBusy ? "cursor-not-allowed opacity-70" : ""
                ].join(" ")}
                onClick={openFilePicker}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!isBusy) setIsDragging(true);
                }}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
              >
                <Upload className="mx-auto h-6 w-6 text-violet-700" aria-hidden="true" />
                <p className="mt-3 text-base font-semibold text-slate-950">{dropTitle}</p>
                <p className="mt-1 text-sm text-slate-600">or choose a file from your computer</p>
                <Button
                  className="mt-4"
                  disabled={isBusy}
                  onClick={(event) => {
                    event.stopPropagation();
                    openFilePicker();
                  }}
                  type="button"
                  variant="secondary"
                >
                  Choose file
                </Button>
                <p className="mt-4 text-xs text-slate-500">
                  {formatLabel} · up to {MAX_FILE_SIZE_MB} MB
                </p>
                <Input
                  accept={accept}
                  className="hidden"
                  onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
            ) : null}

            {file && phase !== "success" ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{file.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {mode === "PDF" ? "PDF" : getImportFileType(file)} · {formatFileSize(file.size)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {mode === "PDF" ? (
                      <Button onClick={previewPdfDocument} type="button" variant="secondary">
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Preview PDF
                      </Button>
                    ) : null}
                    <Button onClick={openFilePicker} type="button" variant="ghost">
                      Replace
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}

            {file && phase !== "success" ? (
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Existing Restock Order</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Optional for standalone stock, recommended when this delivery fulfills a
                      restock ticket.
                    </p>
                  </div>
                  {selectedOrder ? <StatusBadge variant="info">Linked</StatusBadge> : null}
                </div>

                {selectedOrder ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                    <div>
                      <p className="font-semibold text-slate-950">{selectedOrder.orderNumber}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedOrder.lines.filter((line) => line.isSelected).length} selected
                        products · {selectedOrder.status.replaceAll("_", " ").toLowerCase()}
                      </p>
                    </div>
                    <Button onClick={clearRestockOrder} type="button" variant="secondary">
                      Unlink
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        onChange={(event) => {
                          setTicketSearch(event.target.value);
                          setTicketError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void searchRestockTickets();
                          }
                        }}
                        placeholder="Restock Order ID, e.g. RO-20260912..."
                        value={ticketSearch}
                      />
                      <Button
                        disabled={searchingTickets}
                        onClick={() => void searchRestockTickets()}
                        type="button"
                        variant="secondary"
                      >
                        {searchingTickets ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Link2 className="h-4 w-4" aria-hidden="true" />
                        )}
                        Find ticket
                      </Button>
                    </div>
                    {ticketError ? <p className="text-sm text-amber-700">{ticketError}</p> : null}
                    {ticketResults.length > 0 ? (
                      <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                        {ticketResults.map((order) => (
                          <button
                            className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left hover:bg-slate-50"
                            key={order.id}
                            onClick={() => selectRestockOrder(order)}
                            type="button"
                          >
                            <span>
                              <span className="block text-sm font-semibold text-slate-950">
                                {order.orderNumber}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {order.lines.filter((line) => line.isSelected).length} products
                              </span>
                            </span>
                            <StatusBadge variant="warning">
                              {order.status === "PARTIALLY_RECEIVED" ? "Partial" : "Awaiting"}
                            </StatusBadge>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            ) : null}

            {isPreviewing ? (
              <LoadingState
                badge="Delivery"
                helper="This may take a moment for larger spreadsheets."
                label="Validating delivery rows..."
              />
            ) : null}

            {hasSpreadsheetPreview && preview && visibleIssues.length > 0 ? (
              <section className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                <p className="text-sm font-semibold text-rose-900">Unresolved spreadsheet rows</p>
                <div className="mt-2 space-y-1">
                  {visibleIssues.map((issue, index) => (
                    <p className="text-sm text-rose-800" key={`${issue.code}-${index}`}>
                      {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}
                      {issue.message}
                    </p>
                  ))}
                </div>
                <p className="mt-3 text-xs text-rose-800">
                  Unknown products must be created in Products or corrected in the file before this
                  receipt can complete.
                </p>
              </section>
            ) : null}

            {mode === "PDF" && file && !selectedOrder && phase !== "success" ? (
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Build delivery session</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Product name, SKU, barcode, or YSB label can identify an existing Product. No
                    scanner is required.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      setProductError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void searchProducts();
                      }
                    }}
                    placeholder="Product name, SKU, barcode, or YSB label"
                    value={productSearch}
                  />
                  <Button
                    disabled={searchingProducts || productSearch.trim().length === 0}
                    onClick={() => void searchProducts()}
                    type="button"
                    variant="secondary"
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Find
                  </Button>
                </div>
                {productError ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm text-amber-800">{productError}</p>
                    <Button
                      onClick={() => {
                        close();
                        navigate("/products");
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <PackageSearch className="h-4 w-4" aria-hidden="true" />
                      Open Products
                    </Button>
                  </div>
                ) : null}
                {productResults.length > 0 ? (
                  <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                    {productResults.map((option) => (
                      <div className="flex items-center justify-between gap-3 px-4 py-3" key={option.productId}>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{option.productName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{option.sku}</p>
                        </div>
                        <Button onClick={() => addStandalonePdfRow(option)} size="sm" type="button">
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {file && rows.length > 0 && phase !== "success" ? (
              <section className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Delivery Session</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Review only the physical facts. Accepted stock is calculated automatically.
                    </p>
                  </div>
                  {selectedOrder ? (
                    <Button onClick={useExpectedQuantities} type="button" variant="secondary">
                      Use expected quantities
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {pagedRows.map((row) => {
                    const delivered = Math.max(0, wholeNumber(row.deliveredQuantity));
                    const damaged = Math.max(0, wholeNumber(row.damagedQuantity));
                    const accepted = acceptedForRow(row);
                    const missing = missingForRow(row);
                    const overDelivered =
                      row.remainingQuantity !== null && accepted > row.remainingQuantity;
                    return (
                      <article className="rounded-2xl border border-slate-200 bg-white p-4" key={row.rowId}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{row.productName}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{row.sku}</p>
                          </div>
                          {!selectedOrder ? (
                            <Button
                              aria-label={`Remove ${row.productName}`}
                              onClick={() => removeStandaloneRow(row.rowId)}
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>

                        {selectedOrder ? (
                          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                            <SummaryValue label="Expected" value={row.expectedQuantity ?? 0} />
                            <SummaryValue label="Already accepted" value={row.previouslyReceived} />
                            <SummaryValue label="Remaining" value={row.remainingQuantity ?? 0} />
                          </div>
                        ) : null}

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <Field label="Delivered" id={`${row.rowId}-delivered`}>
                            <Input
                              id={`${row.rowId}-delivered`}
                              min={0}
                              onChange={(event) => updateRow(row.rowId, { deliveredQuantity: event.target.value })}
                              type="number"
                              value={row.deliveredQuantity}
                            />
                          </Field>
                          {selectedOrder ? (
                            <Field label="Damaged" id={`${row.rowId}-damaged`}>
                              <Input
                                id={`${row.rowId}-damaged`}
                                max={delivered}
                                min={0}
                                onChange={(event) => updateRow(row.rowId, { damagedQuantity: event.target.value })}
                                type="number"
                                value={row.damagedQuantity}
                              />
                            </Field>
                          ) : null}
                          <SummaryField label="Accepted" value={accepted} />
                          {selectedOrder ? <SummaryField label="Missing" value={missing} /> : null}
                        </div>

                        {damaged > 0 && selectedOrder ? (
                          <div className="mt-3">
                            <Label htmlFor={`${row.rowId}-damage-reason`}>Damage / return reason</Label>
                            <Input
                              id={`${row.rowId}-damage-reason`}
                              onChange={(event) => updateRow(row.rowId, { damageReason: event.target.value })}
                              placeholder="Required for supplier return report"
                              value={row.damageReason}
                            />
                          </div>
                        ) : null}

                        {accepted > 0 ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px]">
                            <Field label="Batch / lot" id={`${row.rowId}-batch`}>
                              <Input
                                id={`${row.rowId}-batch`}
                                maxLength={80}
                                onChange={(event) => updateRow(row.rowId, { batchCode: event.target.value })}
                                placeholder="Supplier batch or lot code"
                                value={row.batchCode}
                              />
                            </Field>
                            <Field label="Expiry" id={`${row.rowId}-expiry`}>
                              <Input
                                disabled={row.noExpiration}
                                id={`${row.rowId}-expiry`}
                                onChange={(event) => updateRow(row.rowId, { expiresAt: event.target.value })}
                                type="date"
                                value={row.expiresAt}
                              />
                            </Field>
                            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
                              <input
                                checked={row.noExpiration}
                                onChange={(event) =>
                                  updateRow(row.rowId, {
                                    noExpiration: event.target.checked,
                                    expiresAt: event.target.checked ? "" : row.expiresAt
                                  })
                                }
                                type="checkbox"
                              />
                              No expiry
                            </label>
                          </div>
                        ) : null}

                        {overDelivered && selectedOrder ? (
                          <label className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            <input
                              checked={row.confirmOverDelivery}
                              onChange={(event) => updateRow(row.rowId, { confirmOverDelivery: event.target.checked })}
                              type="checkbox"
                            />
                            Confirm over-delivery for this Restock Order line.
                          </label>
                        ) : null}
                      </article>
                    );
                  })}
                </div>

                <AppPagination
                  itemLabel="delivery lines"
                  onPageChange={setPage}
                  page={page}
                  pageSize={DELIVERY_PAGE_SIZE}
                  totalItems={rows.length}
                />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Review delivery</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Resolve blocking issues before Complete receipt.
                      </p>
                    </div>
                    <StatusBadge variant={review.blockingIssues > 0 ? "warning" : "success"}>
                      {review.blockingIssues > 0 ? "Needs attention" : "Ready"}
                    </StatusBadge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <ReviewMetric label="Lines" value={review.totalLines} />
                    <ReviewMetric label="Discrepancies" value={review.discrepancies} />
                    <ReviewMetric label="Missing expiry" value={review.missingExpiry} />
                    <ReviewMetric label="Unresolved" value={review.unresolved} />
                  </div>
                  {selectedOrder ? (
                    <p className="mt-3 text-xs text-slate-600">
                      {review.acceptedUnits} accepted · {review.damagedUnits} damaged · {review.missingUnits} missing
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            {isImporting ? (
              <LoadingState
                badge="Receipt"
                helper="The stock-domain transaction must finish before this dialog closes."
                label="Completing bulk receipt..."
              />
            ) : null}

            {phase === "success" && deliverySummary ? (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">Delivery received</p>
                    <p className="mt-1 text-sm text-emerald-800">
                      {deliverySummary.totalUnitsAccepted} units were accepted into Inventory.
                      {deliverySummary.restockOrderNumber
                        ? ` ${deliverySummary.remainingUnits} units remain pending on ${deliverySummary.restockOrderNumber}.`
                        : ""}
                    </p>
                    {deliverySummary.requiresReturnReport ? (
                      <p className="mt-2 text-sm font-medium text-amber-800">
                        Damaged or rejected units were recorded. The supplier return report is available from Receiving.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 bg-slate-50/80 px-6 py-4">
          {phase === "success" ? (
            <Button onClick={close} type="button">Done</Button>
          ) : (
            <>
              <Button disabled={isBusy} onClick={close} type="button" variant="secondary">
                Cancel
              </Button>
              {canPreviewSpreadsheet ? (
                <Button onClick={() => void previewSpreadsheet()} type="button">
                  Preview delivery
                </Button>
              ) : (
                <Button disabled={!canComplete} onClick={() => void completeReceipt()} type="button">
                  Complete receipt
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value.toLocaleString()}</p>
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-900">{value.toLocaleString()}</p>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
