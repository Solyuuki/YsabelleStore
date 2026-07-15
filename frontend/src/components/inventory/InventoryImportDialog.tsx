import { LoaderCircle, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type RefObject } from "react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  confirmInventoryStockImport,
  previewInventoryStockImport,
  type InventoryImportError,
  type InventoryImportPreview,
  type InventoryImportSummary
} from "@/services/catalogApi";
import { formatFileSize, getImportFileType } from "@/utils/importFormatting";
import { waitForMinimumDuration } from "@/utils/timing";

const PREVIEW_MINIMUM_MS = 450;
const IMPORT_MINIMUM_MS = 550;
const MAX_FILE_SIZE_MB = 5;

type Phase =
  | "idle"
  | "file-ready"
  | "previewing"
  | "preview-ready"
  | "importing"
  | "success"
  | "error";

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
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<InventoryImportPreview | null>(null);
  const [summary, setSummary] = useState<InventoryImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

  function reset() {
    requestRef.current += 1;
    setPhase("idle");
    setFile(null);
    setPreview(null);
    setSummary(null);
    setError(null);
    setIsDragging(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function close() {
    onClose();
    reset();
  }

  function getFileValidationError(nextFile: File) {
    const extension = nextFile.name.split(".").pop()?.toLowerCase();

    if (extension !== "csv" && extension !== "xlsx") {
      return "Unsupported file type. Use a CSV or XLSX file.";
    }

    if (nextFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File exceeds ${MAX_FILE_SIZE_MB} MB.`;
    }

    return null;
  }

  function handleFileSelection(nextFile: File | null) {
    if (!nextFile) {
      reset();
      return;
    }

    const validationError = getFileValidationError(nextFile);

    requestRef.current += 1;
    setPhase("file-ready");
    setFile(nextFile);
    setPreview(null);
    setSummary(null);
    setError(null);

    if (validationError) {
      setPhase("error");
      setError(validationError);
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handlePreview() {
    if (!file || phase !== "file-ready") {
      return;
    }

    const sessionId = ++requestRef.current;
    setPhase("previewing");
    setError(null);

    try {
      const response = await waitForMinimumDuration(
        previewInventoryStockImport(file),
        PREVIEW_MINIMUM_MS
      );

      if (sessionId !== requestRef.current) {
        return;
      }

      if (!response.success || !response.data) {
        setPhase("file-ready");
        setError(response.message || "Preview failed.");
        return;
      }

      setPreview(response.data);
      setPhase("preview-ready");
    } catch (previewError) {
      if (sessionId !== requestRef.current) {
        return;
      }

      setPhase("file-ready");
      setError(previewError instanceof Error ? previewError.message : "Preview failed.");
    }
  }

  async function handleImport() {
    if (
      !file ||
      !preview ||
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

      if (sessionId !== requestRef.current) {
        return;
      }

      if (!response.success || !response.data) {
        setPhase("preview-ready");
        setError(response.message || "Import failed.");
        return;
      }

      setSummary(response.data);
      setPhase("success");
      await onImported();
      pushToast({
        title: "Import completed",
        message: `${response.data.importedRows} stock rows were imported successfully.`,
        variant: "success"
      });
    } catch (importError) {
      if (sessionId !== requestRef.current) {
        return;
      }

      setPhase("preview-ready");
      setError(importError instanceof Error ? importError.message : "Import failed.");
    }
  }

  function openFilePicker() {
    if (isBusy) {
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    fileInputRef.current?.click();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (isBusy) {
      return;
    }

    handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  }

  const hasFile = Boolean(file);
  const hasPreview = phase === "preview-ready" && preview !== null;
  const isPreviewing = phase === "previewing";
  const isImporting = phase === "importing";
  const isBusy = isPreviewing || isImporting;
  const canPreview = phase === "file-ready" && hasFile && !isBusy;
  const canImport = Boolean(
    hasPreview &&
    preview &&
    preview.invalidRows === 0 &&
    preview.errors.length === 0 &&
    !isImporting
  );
  const invalidRows = preview?.rows.filter((row) => !row.valid) ?? [];
  const visibleInvalidRows = invalidRows.slice(0, 10);
  const previewSummaryText = hasPreview
    ? `${preview.validRows} valid rows, ${preview.invalidRows} invalid rows, ${preview.warnings.length} warnings.`
    : "";
  const fileStatusLabel =
    phase === "previewing"
      ? "Previewing stock rows..."
      : phase === "preview-ready"
        ? "Preview ready"
        : phase === "importing"
          ? "Importing stock..."
          : phase === "success"
            ? "Imported"
            : "Ready to preview";
  const previewBlockReason =
    !hasPreview || !preview
      ? null
      : preview.errors.length > 0
        ? "Resolve blocking preview errors before importing."
        : preview.invalidRows > 0
          ? "Fix invalid rows before importing."
          : null;
  const liveAnnouncement = isPreviewing
    ? "Preparing preview. Reading inventory rows and checking validation issues."
    : isImporting
      ? "Importing stock. Saving validated rows and refreshing inventory."
      : phase === "success" && summary
        ? `Import completed. ${summary.importedRows} stock rows imported and inventory refreshed.`
        : (error ?? "");

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isImporting) {
          close();
        }
      }}
    >
      <DialogContent
        aria-describedby="inventory-stock-import-description"
        className="flex max-h-[88vh] w-[calc(100vw-40px)] max-w-[700px] flex-col overflow-hidden p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef?.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (isImporting) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isImporting) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isImporting) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="relative border-b border-slate-200 px-6 py-6 pr-14">
          <DialogClose asChild>
            <Button
              aria-label="Close inventory import dialog"
              className="absolute right-4 top-4"
              disabled={isImporting}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogClose>
          <div className="space-y-2">
            <DialogTitle>Import inventory stock</DialogTitle>
            <DialogDescription id="inventory-stock-import-description" className="max-w-prose">
              Add stock batches to existing products using the official inventory template.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div
          className={["px-6 py-5", hasPreview ? "max-h-[calc(88vh-10rem)] overflow-y-auto" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="space-y-4">
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {liveAnnouncement}
            </p>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Template tips</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
                <li>Download the template first, then fill in at least one stock row.</li>
                <li>Use an existing SKU or barcode.</li>
                <li>Quantity means stock to add.</li>
                <li>Keep the headers unchanged.</li>
                <li>Batch code identifies the physical stock lot.</li>
                <li>Use YYYY-MM-DD for expiration dates.</li>
                <li>Leave expiration date blank only for non-expiring products.</li>
              </ul>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Import error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div
              aria-disabled={isBusy}
              aria-label="Upload inventory stock file"
              className={[
                "cursor-pointer rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 p-6 transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200",
                isBusy ? "cursor-not-allowed opacity-70" : "",
                isDragging ? "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-100" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={openFilePicker}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => {
                event.preventDefault();

                if (!isBusy) {
                  setIsDragging(true);
                }
              }}
              onDrop={handleDrop}
              onKeyDown={(event) => {
                if (isBusy) {
                  return;
                }

                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openFilePicker();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="mx-auto flex max-w-[520px] flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-950">
                  Drop a CSV or Excel file here
                </p>
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
                  Browse files
                </Button>
                <p className="mt-4 text-xs font-medium text-slate-500">
                  CSV or XLSX, up to {MAX_FILE_SIZE_MB} MB
                </p>
              </div>

              <Input
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
                ref={fileInputRef}
                type="file"
              />
            </div>

            {hasFile && file ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-slate-950">{file.name}</p>
                    <p className="text-sm text-slate-600">
                      {getImportFileType(file)} · {formatFileSize(file.size)}
                    </p>
                    <p className="text-sm font-medium text-emerald-700">{fileStatusLabel}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={isBusy}
                      onClick={openFilePicker}
                      type="button"
                      variant="secondary"
                    >
                      Replace
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() => handleFileSelection(null)}
                      type="button"
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {isPreviewing ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <LoadingState
                  badge="Preview"
                  helper="This may take a moment for larger files."
                  label="Validating stock rows..."
                />
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Reading rows, validating columns, and checking existing batches.
                </p>
              </div>
            ) : null}

            {isImporting ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <LoadingState
                  badge="Import"
                  helper="Saving validated rows to inventory and refreshing the stock summary."
                  label="Importing stock..."
                />
              </div>
            ) : null}

            {hasPreview && preview && !isImporting ? (
              <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Preview ready</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{previewSummaryText}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard label="Total rows" tone="neutral" value={preview.totalRows} />
                  <SummaryCard label="Valid rows" tone="success" value={preview.validRows} />
                  <SummaryCard label="Invalid rows" tone="danger" value={preview.invalidRows} />
                  <SummaryCard label="Warnings" tone="neutral" value={preview.warnings.length} />
                </div>

                {preview.errors.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertTitle>Preview error</AlertTitle>
                    <AlertDescription>
                      {preview.errors[0]?.message ?? "Preview failed."}
                    </AlertDescription>
                  </Alert>
                ) : null}

                {previewBlockReason ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {previewBlockReason}
                  </div>
                ) : null}

                {visibleInvalidRows.length > 0 ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200">
                    <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-600">
                          <span className="font-semibold text-slate-950">
                            {preview.invalidRows}
                          </span>{" "}
                          invalid rows
                          {preview.errors.length > 0
                            ? ` · ${preview.errors.length} blocking issue(s)`
                            : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Showing the first 10 invalid rows
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <Table className="min-w-[760px] border-collapse text-left text-sm">
                        <TableHeader className="bg-slate-100 text-slate-700">
                          <TableRow>
                            <TableHead className="px-4 py-3 font-semibold">Row</TableHead>
                            <TableHead className="px-4 py-3 font-semibold">Product</TableHead>
                            <TableHead className="px-4 py-3 font-semibold">Field</TableHead>
                            <TableHead className="px-4 py-3 font-semibold">Current value</TableHead>
                            <TableHead className="px-4 py-3 font-semibold">Issue</TableHead>
                            <TableHead className="px-4 py-3 font-semibold">Result</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-slate-200 bg-white">
                          {visibleInvalidRows.map((row) => {
                            const rowIssues = row.errors.length > 0 ? row.errors : row.warnings;
                            const primaryIssue = rowIssues[0] ?? null;
                            const extraIssueCount = Math.max(rowIssues.length - 1, 0);

                            return (
                              <TableRow className="align-top" key={row.rowNumber}>
                                <TableCell className="px-4 py-3 font-medium text-slate-950">
                                  {row.rowNumber}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-slate-700">
                                  {row.productName ?? row.productId ?? "-"}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-slate-700">
                                  {getReadableIssueField(primaryIssue?.field)}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-slate-700">
                                  {getReadableIssueValue(primaryIssue)}
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                  <div className="space-y-1">
                                    <p className="font-medium text-slate-950">
                                      {primaryIssue
                                        ? getReadableIssueLabel(primaryIssue)
                                        : "Invalid row"}
                                    </p>
                                    <p className="text-xs leading-5 text-slate-600">
                                      {primaryIssue?.message ??
                                        "Review the row values and try again."}
                                    </p>
                                    {extraIssueCount > 0 ? (
                                      <p className="text-xs font-medium text-slate-500">
                                        +{extraIssueCount} more issue
                                        {extraIssueCount === 1 ? "" : "s"}
                                      </p>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                  <StatusBadge variant="error">Invalid</StatusBadge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-medium text-emerald-900">No invalid rows found.</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      The file is ready to import.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {phase === "success" && summary ? (
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-emerald-950">Import complete</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-800">
                    Imported {summary.importedRows} rows and refreshed inventory batches.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SummaryCard label="Imported rows" tone="success" value={summary.importedRows} />
                  <SummaryCard
                    label="Products updated"
                    tone="neutral"
                    value={summary.productsUpdated}
                  />
                  <SummaryCard
                    label="Batches created"
                    tone="neutral"
                    value={summary.batchesCreated}
                  />
                  <SummaryCard
                    label="Batches updated"
                    tone="neutral"
                    value={summary.batchesUpdated}
                  />
                  <SummaryCard label="Units added" tone="neutral" value={summary.totalUnitsAdded} />
                  <SummaryCard
                    label="Expiry records added"
                    tone="neutral"
                    value={summary.expiryRecordsAdded}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 shrink-0 border-t border-slate-200 bg-slate-50/90 px-6 py-4 backdrop-blur">
          {phase === "success" ? (
            <Button onClick={close} type="button">
              Close
            </Button>
          ) : isImporting ? (
            <>
              <Button disabled type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled type="button">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Importing stock...
              </Button>
            </>
          ) : isPreviewing ? (
            <>
              <Button onClick={close} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled type="button">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Previewing stock rows...
              </Button>
            </>
          ) : canPreview ? (
            <>
              <Button onClick={close} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={!canPreview} onClick={() => void handlePreview()} type="button">
                Preview stock rows
              </Button>
            </>
          ) : hasPreview ? (
            <>
              <Button disabled={isBusy} onClick={openFilePicker} type="button" variant="secondary">
                Replace file
              </Button>
              <Button disabled={!canImport} onClick={() => void handleImport()} type="button">
                Import valid stock rows
              </Button>
            </>
          ) : (
            <>
              <Button onClick={close} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={!canPreview} onClick={() => void handlePreview()} type="button">
                Preview stock rows
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: "neutral" | "success" | "danger";
  value: number;
}) {
  const toneClasses = {
    neutral: "border-slate-200 bg-slate-50",
    success: "border-emerald-200 bg-emerald-50",
    danger: "border-red-200 bg-red-50"
  } as const;

  const labelClasses = {
    neutral: "text-slate-500",
    success: "text-emerald-700",
    danger: "text-red-700"
  } as const;

  const valueClasses = {
    neutral: "text-slate-950",
    success: "text-emerald-900",
    danger: "text-red-900"
  } as const;

  return (
    <div className={`rounded-xl border px-3 py-3 ${toneClasses[tone]}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${labelClasses[tone]}`}>
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${valueClasses[tone]}`}>{value}</p>
    </div>
  );
}

function getReadableIssueField(field?: string) {
  if (!field) {
    return "File";
  }

  const fieldLabels: Record<string, string> = {
    batchCode: "Batch code",
    barcode: "Barcode",
    expirationDate: "Expiration date",
    header: "Header",
    quantity: "Quantity to add",
    reason: "Reason",
    sku: "SKU"
  };

  const label = fieldLabels[field];

  if (label) {
    return label;
  }

  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function getReadableIssueValue(issue: Pick<InventoryImportError, "value"> | null) {
  if (!issue) {
    return "-";
  }

  if (issue.value === null || issue.value === undefined) {
    return "Empty";
  }

  const normalizedValue = String(issue.value).trim();

  return normalizedValue.length > 0 ? normalizedValue : "Empty";
}

function getReadableIssueLabel(issue: Pick<InventoryImportError, "code" | "message">) {
  const labels: Record<string, string> = {
    DUPLICATE_STOCK_ROW_IN_FILE: "Duplicate stock row",
    EMPTY_IMPORT_FILE: "Empty file",
    FORMULA_NOT_ALLOWED: "Formula not allowed",
    INVALID_BATCH_CODE: "Invalid batch code",
    INVALID_EXPIRATION_DATE: "Invalid expiration date",
    INVALID_HEADERS: "Invalid headers",
    INVALID_QUANTITY: "Invalid quantity",
    INVALID_REASON: "Invalid reason",
    PAST_EXPIRATION_DATE: "Expired stock",
    PRODUCT_NOT_FOUND: "Product not found",
    SKU_BARCODE_MISMATCH: "Product mismatch",
    MISSING_PRODUCT_IDENTIFIER: "Missing product identifier",
    UNSUPPORTED_IMPORT_FILE_MIME: "Unsupported file type",
    UNSUPPORTED_IMPORT_FILE_TYPE: "Unsupported file type"
  };

  const label = labels[issue.code];

  if (label) {
    return label;
  }

  return issue.code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
