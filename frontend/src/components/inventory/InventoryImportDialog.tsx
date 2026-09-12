import {
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from "react";

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
  confirmInventoryStockImport,
  fetchProducts,
  lookupInventoryByBarcode,
  previewInventoryStockImport,
  type InventoryImportPreview,
  type InventoryImportSummary
} from "@/services/catalogApi";
import {
  completeBulkDeliverySession,
  type BulkDeliverySessionResult
} from "@/services/bulkDeliveryApi";
import { formatFileSize, getImportFileType } from "@/utils/importFormatting";
import { waitForMinimumDuration } from "@/utils/timing";

const PREVIEW_MINIMUM_MS = 450;
const IMPORT_MINIMUM_MS = 550;
const MAX_FILE_SIZE_MB = 20;

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

type PdfDeliveryRow = ProductOption & {
  rowId: string;
  receivedQuantity: string;
  batchCode: string;
  expiresAt: string;
  noExpiration: boolean;
};

function wholeNumber(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function fileExtension(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) ?? "" : "";
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
  const { pushToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef(0);
  const [mode, setMode] = useState<ImportMode>("SPREADSHEET");
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<InventoryImportPreview | null>(null);
  const [spreadsheetSummary, setSpreadsheetSummary] = useState<InventoryImportSummary | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<BulkDeliverySessionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pdfRows, setPdfRows] = useState<PdfDeliveryRow[]>([]);

  const isPreviewing = phase === "previewing";
  const isImporting = phase === "importing";
  const isBusy = isPreviewing || isImporting;
  const hasSpreadsheetPreview = mode === "SPREADSHEET" && phase === "preview-ready" && preview;
  const visibleIssues = useMemo(() => preview?.errors.slice(0, 8) ?? [], [preview]);

  const pdfReview = useMemo(() => {
    const missingBatch = pdfRows.filter((row) => row.batchCode.trim().length === 0).length;
    const missingExpiry = pdfRows.filter(
      (row) => !row.noExpiration && row.expiresAt.trim().length === 0
    ).length;
    const invalidQuantity = pdfRows.filter((row) => wholeNumber(row.receivedQuantity) === 0).length;

    return {
      totalLines: pdfRows.length,
      missingBatch,
      missingExpiry,
      invalidQuantity,
      blockingIssues: missingBatch + missingExpiry + invalidQuantity
    };
  }, [pdfRows]);

  useEffect(() => {
    if (!open) return;
    resetAll();
  }, [open]);

  function resetAll() {
    requestRef.current += 1;
    setMode("SPREADSHEET");
    setPhase("idle");
    setFile(null);
    setPreview(null);
    setSpreadsheetSummary(null);
    setDeliverySummary(null);
    setError(null);
    setIsDragging(false);
    setShowGuide(false);
    setSearchText("");
    setSearchResults([]);
    setSearchError(null);
    setPdfRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetMode(nextMode: ImportMode) {
    if (isBusy) return;
    requestRef.current += 1;
    setMode(nextMode);
    setPhase("idle");
    setFile(null);
    setPreview(null);
    setSpreadsheetSummary(null);
    setDeliverySummary(null);
    setError(null);
    setIsDragging(false);
    setSearchText("");
    setSearchResults([]);
    setSearchError(null);
    setPdfRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function close() {
    if (isBusy) return;
    onClose();
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
    if (nextFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File exceeds ${MAX_FILE_SIZE_MB} MB.`;
    }

    return null;
  }

  function handleFileSelection(nextFile: File | null) {
    if (!nextFile) {
      setPhase("idle");
      setFile(null);
      setPreview(null);
      setSpreadsheetSummary(null);
      setDeliverySummary(null);
      setError(null);
      setPdfRows([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const validationError = getFileValidationError(nextFile);
    requestRef.current += 1;
    setFile(validationError ? null : nextFile);
    setPreview(null);
    setSpreadsheetSummary(null);
    setDeliverySummary(null);
    setError(validationError);
    setPhase(validationError ? "error" : "file-ready");
    setSearchText("");
    setSearchResults([]);
    setSearchError(null);
    setPdfRows([]);

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
    if (isBusy) return;
    handleFileSelection(event.dataTransfer.files?.[0] ?? null);
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
      setPhase("preview-ready");
    } catch (previewError) {
      if (sessionId !== requestRef.current) return;
      setPhase("file-ready");
      setError(previewError instanceof Error ? previewError.message : "Delivery preview failed.");
    }
  }

  async function completeSpreadsheetReceipt() {
    if (
      !file ||
      !preview ||
      mode !== "SPREADSHEET" ||
      phase !== "preview-ready" ||
      preview.invalidRows > 0 ||
      preview.errors.length > 0
    ) {
      return;
    }

    const sessionId = ++requestRef.current;
    setPhase("importing");
    setError(null);

    try {
      const response = await waitForMinimumDuration(
        confirmInventoryStockImport(file),
        IMPORT_MINIMUM_MS
      );
      if (sessionId !== requestRef.current) return;
      if (!response.success || !response.data) {
        setPhase("preview-ready");
        setError(response.message || "Receipt completion failed.");
        return;
      }

      setSpreadsheetSummary(response.data);
      setPhase("success");
      await onImported();
      pushToast({
        title: "Bulk receipt completed",
        message: `${response.data.importedRows} delivery lines were added to Inventory.`,
        variant: "success"
      });
    } catch (importError) {
      if (sessionId !== requestRef.current) return;
      setPhase("preview-ready");
      setError(importError instanceof Error ? importError.message : "Receipt completion failed.");
    }
  }

  async function searchProducts() {
    const query = searchText.trim();
    if (!query || searching) return;

    setSearching(true);
    setSearchError(null);

    try {
      const [catalogResult, barcodeResult] = await Promise.allSettled([
        fetchProducts({ page: 1, pageSize: 8, search: query }),
        lookupInventoryByBarcode(query)
      ]);

      const options = new Map<string, ProductOption>();

      if (catalogResult.status === "fulfilled") {
        catalogResult.value.items.forEach((product) => {
          options.set(product.id, optionFromProduct(product));
        });
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
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No canonical Product matched that name, SKU, barcode, or YSB label.");
      }
    } catch (lookupError) {
      setSearchResults([]);
      setSearchError(lookupError instanceof Error ? lookupError.message : "Product lookup failed.");
    } finally {
      setSearching(false);
    }
  }

  function addPdfRow(option: ProductOption) {
    setPdfRows((current) => [
      ...current,
      {
        ...option,
        rowId: crypto.randomUUID(),
        receivedQuantity: "1",
        batchCode: "",
        expiresAt: "",
        noExpiration: true
      }
    ]);
    setSearchResults([]);
    setSearchText("");
    setSearchError(null);
  }

  function updatePdfRow(rowId: string, patch: Partial<PdfDeliveryRow>) {
    setPdfRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
  }

  function removePdfRow(rowId: string) {
    setPdfRows((current) => current.filter((row) => row.rowId !== rowId));
  }

  function previewPdfDocument() {
    if (!file || mode !== "PDF") return;
    const objectUrl = URL.createObjectURL(file);
    const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      setError("The browser blocked the PDF preview. Allow pop-ups for this local app and try again.");
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  async function completePdfReceipt() {
    if (!file || mode !== "PDF" || pdfRows.length === 0 || pdfReview.blockingIssues > 0) return;

    const sessionId = ++requestRef.current;
    setPhase("importing");
    setError(null);

    try {
      const result = await waitForMinimumDuration(
        completeBulkDeliverySession({
          sourceType: "PDF",
          sourceFileName: file.name,
          rows: pdfRows.map((row) => ({
            productId: row.productId,
            receivedQuantity: wholeNumber(row.receivedQuantity),
            batchCode: row.batchCode.trim(),
            expiresAt: row.noExpiration ? null : row.expiresAt,
            noExpiration: row.noExpiration,
            reason: "Bulk delivery receipt from supplier PDF"
          }))
        }),
        IMPORT_MINIMUM_MS
      );

      if (sessionId !== requestRef.current) return;
      setDeliverySummary(result);
      setPhase("success");
      await onImported();
      pushToast({
        title: "Bulk receipt completed",
        message: `${result.totalLines} delivery lines and ${result.totalUnitsReceived} units were received.`,
        variant: "success"
      });
    } catch (receiptError) {
      if (sessionId !== requestRef.current) return;
      setPhase("file-ready");
      setError(receiptError instanceof Error ? receiptError.message : "Receipt completion failed.");
    }
  }

  const canPreviewSpreadsheet = mode === "SPREADSHEET" && phase === "file-ready" && Boolean(file);
  const canCompleteSpreadsheet = Boolean(
    mode === "SPREADSHEET" &&
      preview &&
      phase === "preview-ready" &&
      preview.invalidRows === 0 &&
      preview.errors.length === 0
  );
  const canCompletePdf = Boolean(
    mode === "PDF" && file && pdfRows.length > 0 && pdfReview.blockingIssues === 0 && !isBusy
  );
  const accept = mode === "SPREADSHEET" ? ".csv,.xlsx" : ".pdf";
  const dropTitle =
    mode === "SPREADSHEET" ? "Drop an Excel or CSV delivery file here" : "Drop a delivery PDF here";
  const chooseLabel = mode === "SPREADSHEET" ? "Choose file" : "Choose PDF";
  const formatLabel = mode === "SPREADSHEET" ? "CSV or XLSX" : "PDF";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
      }}
    >
      <DialogContent
        aria-describedby="inventory-bulk-delivery-description"
        className="flex max-h-[88vh] w-[calc(100vw-40px)] max-w-[760px] flex-col overflow-hidden p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef?.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (isBusy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isBusy) event.preventDefault();
        }}
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
                aria-controls="inventory-bulk-delivery-guide"
                aria-expanded={showGuide}
                className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
                disabled={isBusy}
                onClick={() => setShowGuide((current) => !current)}
                type="button"
                variant="secondary"
              >
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold"
                >
                  ?
                </span>
                Guide
              </Button>
            </div>
            <DialogDescription id="inventory-bulk-delivery-description" className="max-w-prose">
              Prepare a bulk delivery from Excel/CSV or a supplier PDF, review the receipt, then add
              only validated physical stock to Inventory.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {showGuide ? (
              <section
                className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5"
                id="inventory-bulk-delivery-guide"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Bulk delivery guide</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {mode === "SPREADSHEET"
                        ? "Use the structured template when the supplier delivery is already available as rows. The file is validated before receipt."
                        : "Use the supplier PDF as the delivery reference, then identify each physical product by name, SKU, barcode, or YSB internal label. No scanner is required."}
                    </p>
                  </div>
                  <Button
                    aria-label="Hide bulk delivery guide"
                    className="shrink-0"
                    onClick={() => setShowGuide(false)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Hide
                  </Button>
                </div>

                <div className="mt-4 rounded-xl border border-violet-100 bg-white/80 p-4 text-sm leading-6 text-slate-700">
                  {mode === "SPREADSHEET" ? (
                    <>
                      <p className="font-semibold text-slate-950">Excel / CSV fields</p>
                      <p className="mt-1 font-mono text-xs text-slate-600">
                        sku, barcode, quantity, batchCode, expirationDate, reason
                      </p>
                      <p className="mt-2">
                        Use either SKU or barcode. Batch is required. Leave expiration blank only
                        for products that truly do not expire.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-950">PDF delivery session</p>
                      <p className="mt-1">
                        Open the PDF for reference, find each canonical Product, then record the
                        received quantity, supplier batch/lot, and expiry or explicit no-expiry
                        state before completing the receipt.
                      </p>
                    </>
                  )}
                </div>
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
                aria-disabled={isBusy}
                aria-label={`Upload ${mode === "SPREADSHEET" ? "Excel or CSV" : "PDF"} delivery file`}
                className={[
                  "cursor-pointer rounded-2xl border border-dashed p-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2",
                  isDragging
                    ? "border-violet-600 bg-violet-100 ring-violet-200"
                    : "border-violet-300 bg-violet-50/70 hover:border-violet-400 hover:bg-violet-50 focus-visible:border-violet-500 focus-visible:ring-violet-200",
                  isBusy ? "cursor-not-allowed opacity-70" : ""
                ].join(" ")}
                onClick={openFilePicker}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!isBusy) setIsDragging(true);
                }}
                onDrop={handleDrop}
                onKeyDown={(event) => {
                  if (isBusy) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openFilePicker();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="mx-auto flex max-w-[580px] flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-violet-300 bg-white text-violet-700 shadow-sm">
                    <Upload className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-950">{dropTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    or choose a file from your computer
                  </p>
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
                    {chooseLabel}
                  </Button>
                  <p className="mt-4 text-xs font-medium leading-5 text-slate-500">
                    {formatLabel} · up to {MAX_FILE_SIZE_MB} MB
                  </p>
                </div>

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
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-slate-950">{file.name}</p>
                    <p className="text-sm text-slate-600">
                      {mode === "PDF" ? "PDF" : getImportFileType(file)} · {formatFileSize(file.size)}
                    </p>
                    <p className="text-sm font-medium text-violet-700">
                      {isPreviewing
                        ? "Preparing delivery preview..."
                        : isImporting
                          ? "Completing receipt..."
                          : "Ready for delivery review"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mode === "PDF" ? (
                      <Button
                        disabled={isBusy}
                        onClick={previewPdfDocument}
                        type="button"
                        variant="secondary"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Preview PDF
                      </Button>
                    ) : null}
                    <Button disabled={isBusy} onClick={openFilePicker} type="button" variant="ghost">
                      Replace
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {isPreviewing ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <LoadingState
                  badge="Delivery"
                  helper="This may take a moment for larger spreadsheets."
                  label="Validating delivery rows..."
                />
              </div>
            ) : null}

            {hasSpreadsheetPreview && preview ? (
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Review delivery</p>
                  <p className="mt-1 text-sm text-slate-600">
                    The spreadsheet has been validated before any physical stock is recorded.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <ReviewMetric label="Lines" value={preview.totalRows} />
                  <ReviewMetric label="Valid" value={preview.validRows} />
                  <ReviewMetric label="Blocking" value={preview.invalidRows} />
                  <ReviewMetric label="Warnings" value={preview.warnings.length} />
                </div>

                {visibleIssues.length > 0 ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                    <p className="text-sm font-semibold text-rose-900">Blocking issues</p>
                    <div className="mt-2 space-y-2">
                      {visibleIssues.map((issue, index) => (
                        <p className="text-sm leading-5 text-rose-800" key={`${issue.code}-${index}`}>
                          {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}
                          {issue.message}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Ready to receive</p>
                      <p className="mt-1 text-sm text-emerald-800">
                        No blocking spreadsheet issues were detected.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            {mode === "PDF" && file && phase !== "success" ? (
              <>
                <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Build delivery session</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Find the physical product by name, SKU, barcode, or YSB internal label. Add one
                      row for each supplier batch/lot on the PDF.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      onChange={(event) => {
                        setSearchText(event.target.value);
                        setSearchError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void searchProducts();
                        }
                      }}
                      placeholder="Product name, SKU, barcode, or YSB label"
                      value={searchText}
                    />
                    <Button
                      disabled={searching || searchText.trim().length === 0}
                      onClick={() => void searchProducts()}
                      type="button"
                      variant="secondary"
                    >
                      {searching ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Search className="h-4 w-4" aria-hidden="true" />
                      )}
                      Find
                    </Button>
                  </div>

                  {searchError ? <p className="text-sm text-amber-700">{searchError}</p> : null}

                  {searchResults.length > 0 ? (
                    <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                      {searchResults.map((option) => (
                        <div
                          className="flex items-center justify-between gap-3 bg-white px-4 py-3"
                          key={option.productId}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {option.productName}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {option.sku}
                              {option.barcode ? ` · ${option.barcode}` : ""}
                            </p>
                          </div>
                          <Button onClick={() => addPdfRow(option)} size="sm" type="button">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                {pdfRows.length > 0 ? (
                  <section className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Delivery lines</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Record the physical quantity and supplier lot details exactly as received.
                        </p>
                      </div>
                      <StatusBadge variant="info">{pdfRows.length} lines</StatusBadge>
                    </div>

                    <div className="space-y-3">
                      {pdfRows.map((row) => (
                        <div
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          key={row.rowId}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">
                                {row.productName}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">{row.sku}</p>
                            </div>
                            <Button
                              aria-label={`Remove ${row.productName}`}
                              onClick={() => removePdfRow(row.rowId)}
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label htmlFor={`${row.rowId}-quantity`}>Received quantity</Label>
                              <Input
                                id={`${row.rowId}-quantity`}
                                min={1}
                                onChange={(event) =>
                                  updatePdfRow(row.rowId, { receivedQuantity: event.target.value })
                                }
                                type="number"
                                value={row.receivedQuantity}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`${row.rowId}-batch`}>Batch / lot</Label>
                              <Input
                                id={`${row.rowId}-batch`}
                                maxLength={80}
                                onChange={(event) =>
                                  updatePdfRow(row.rowId, { batchCode: event.target.value })
                                }
                                placeholder="Supplier batch or lot code"
                                value={row.batchCode}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`${row.rowId}-expiry`}>Expiry</Label>
                              <Input
                                disabled={row.noExpiration}
                                id={`${row.rowId}-expiry`}
                                onChange={(event) =>
                                  updatePdfRow(row.rowId, { expiresAt: event.target.value })
                                }
                                type="date"
                                value={row.expiresAt}
                              />
                            </div>
                            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
                              <input
                                checked={row.noExpiration}
                                onChange={(event) =>
                                  updatePdfRow(row.rowId, {
                                    noExpiration: event.target.checked,
                                    expiresAt: event.target.checked ? "" : row.expiresAt
                                  })
                                }
                                type="checkbox"
                              />
                              No expiry printed
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">Review delivery</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Blocking values must be resolved before the atomic receipt can complete.
                          </p>
                        </div>
                        <StatusBadge variant={pdfReview.blockingIssues > 0 ? "warning" : "success"}>
                          {pdfReview.blockingIssues > 0 ? "Needs attention" : "Ready"}
                        </StatusBadge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <ReviewMetric label="Lines" value={pdfReview.totalLines} />
                        <ReviewMetric label="Missing batch" value={pdfReview.missingBatch} />
                        <ReviewMetric label="Missing expiry" value={pdfReview.missingExpiry} />
                        <ReviewMetric label="Invalid qty" value={pdfReview.invalidQuantity} />
                      </div>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}

            {isImporting ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <LoadingState
                  badge="Receipt"
                  helper="The delivery commits atomically; all lines succeed or the session rolls back."
                  label="Completing bulk receipt..."
                />
              </div>
            ) : null}

            {phase === "success" ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">Delivery received</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      {mode === "SPREADSHEET" && spreadsheetSummary
                        ? `${spreadsheetSummary.importedRows} lines and ${spreadsheetSummary.totalUnitsAdded} units were added to Inventory.`
                        : deliverySummary
                          ? `${deliverySummary.totalLines} lines and ${deliverySummary.totalUnitsReceived} units were added to Inventory.`
                          : "The delivery receipt completed successfully."}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 bg-slate-50/80 px-6 py-4">
          {phase === "success" ? (
            <Button onClick={close} type="button">
              Done
            </Button>
          ) : (
            <>
              <Button disabled={isBusy} onClick={close} type="button" variant="secondary">
                Cancel
              </Button>

              {mode === "SPREADSHEET" && phase !== "preview-ready" ? (
                <Button
                  disabled={!canPreviewSpreadsheet || isBusy}
                  onClick={() => void previewSpreadsheet()}
                  type="button"
                >
                  {isPreviewing ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Preview delivery
                </Button>
              ) : null}

              {mode === "SPREADSHEET" && phase === "preview-ready" ? (
                <Button
                  disabled={!canCompleteSpreadsheet || isBusy}
                  onClick={() => void completeSpreadsheetReceipt()}
                  type="button"
                >
                  {isImporting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Complete receipt
                </Button>
              ) : null}

              {mode === "PDF" ? (
                <Button
                  disabled={!canCompletePdf || isBusy}
                  onClick={() => void completePdfReceipt()}
                  type="button"
                >
                  {isImporting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Complete receipt
                </Button>
              ) : null}
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
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value.toLocaleString()}</p>
    </div>
  );
}
