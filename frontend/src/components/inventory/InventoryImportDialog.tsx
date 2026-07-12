import { FileUp, LoaderCircle, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";

import { AppPagination } from "@/components/shared/AppPagination";
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
  type InventoryImportPreview,
  type InventoryImportSummary
} from "@/services/catalogApi";
import { useToast } from "@/components/shared/ToastProvider";
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
  onImported
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
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

  async function handleFileSelection(nextFile: File | null) {
    if (!nextFile) {
      reset();
      return;
    }

    const validationError = getFileValidationError(nextFile);
    const sessionId = ++requestRef.current;
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
      return;
    }

    if (sessionId !== requestRef.current) return;
  }

  async function handlePreview() {
    if (!file || phase !== "file-ready") return;
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
        setError(response.message || "Preview failed.");
        return;
      }

      setPreview(response.data);
      setPhase("preview-ready");
    } catch (previewError) {
      if (sessionId !== requestRef.current) return;
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

      if (sessionId !== requestRef.current) return;

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
      if (sessionId !== requestRef.current) return;
      setPhase("preview-ready");
      setError(importError instanceof Error ? importError.message : "Import failed.");
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (phase === "importing") return;
    void handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  }

  const hasPreview = phase === "preview-ready" && preview !== null;
  const isPreviewing = phase === "previewing";
  const isImporting = phase === "importing";
  const isSuccess = phase === "success";
  const canPreview = phase === "file-ready" && file !== null;
  const canImport = Boolean(
    hasPreview && preview && preview.invalidRows === 0 && preview.errors.length === 0
  );
  const invalidRows = preview?.rows.filter((row) => !row.valid) ?? [];
  const visibleInvalidRows = invalidRows.slice(0, 8);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && phase !== "importing") close();
      }}
    >
      <DialogContent
        aria-describedby="inventory-stock-import-description"
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-[860px] flex-col gap-0 p-0"
      >
        <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14">
          <DialogClose asChild>
            <Button
              aria-label="Close inventory import dialog"
              className="absolute right-4 top-4"
              disabled={phase === "importing"}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
          <DialogTitle>Import inventory stock</DialogTitle>
          <DialogDescription id="inventory-stock-import-description">
            Add stock batches to existing products using the official inventory template.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
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

          {summary ? (
            <Alert>
              <AlertTitle>Import completed</AlertTitle>
              <AlertDescription>
                {summary.importedRows} rows imported, {summary.productsUpdated} products updated,{" "}
                {summary.totalUnitsAdded} units added.
              </AlertDescription>
            </Alert>
          ) : null}

          <div
            className={[
              "cursor-pointer rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 p-6 transition-colors hover:border-emerald-300 hover:bg-emerald-50",
              isDragging ? "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-100" : ""
            ].join(" ")}
            onClick={() => fileInputRef.current?.click()}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDrop={handleDrop}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="mx-auto flex max-w-[520px] flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm">
                <Upload className="h-5 w-5" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-950">
                Drop a CSV or Excel file here
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                or choose a file from your computer
              </p>
              <Button
                className="mt-4"
                disabled={isImporting}
                onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
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
              onChange={(event) => void handleFileSelection(event.target.files?.[0] ?? null)}
              ref={fileInputRef}
              type="file"
            />
          </div>

          {file ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{file.name}</p>
                  <p className="text-sm text-slate-600">{file.type || "File"}</p>
                  <p className="text-sm font-medium text-emerald-700">
                    {phase === "preview-ready"
                      ? "Preview ready"
                      : isSuccess
                        ? "Imported"
                        : "Ready to preview"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={phase === "importing"}
                    onClick={() => void handleFileSelection(null)}
                    type="button"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {canPreview ? (
            <Button disabled={isPreviewing} onClick={() => void handlePreview()} type="button">
              {isPreviewing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isPreviewing ? "Reading file..." : "Preview stock rows"}
            </Button>
          ) : null}

          {isPreviewing ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">Validating stock rows</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Reading rows, validating columns, and checking existing batches.
              </p>
            </div>
          ) : null}

          {hasPreview && preview ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-4">
                <SummaryCard label="Total rows" value={preview.totalRows} />
                <SummaryCard label="Ready" value={preview.validRows} />
                <SummaryCard label="Invalid" value={preview.invalidRows} />
                <SummaryCard label="Warnings" value={preview.warnings.length} />
              </div>

              {preview.errors.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTitle>Blocking issues found</AlertTitle>
                  <AlertDescription>
                    {preview.errors[0]?.message ?? "Resolve the errors before importing."}
                  </AlertDescription>
                </Alert>
              ) : null}

              {visibleInvalidRows.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-100">
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Product reference</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Issue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleInvalidRows.map((row) => (
                        <TableRow key={row.rowNumber}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>{row.productName ?? row.productId ?? "-"}</TableCell>
                          <TableCell>{row.errors[0]?.field ?? "-"}</TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {row.errors[0]?.message ?? "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {preview.rows.length > 8 ? (
                <AppPagination
                  itemLabel="rows"
                  page={1}
                  pageSize={8}
                  totalItems={preview.rows.length}
                  totalPages={Math.ceil(preview.rows.length / 8)}
                  onPageChange={() => undefined}
                  isLoading={false}
                  className="hidden"
                />
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!canImport || isImporting}
                  onClick={() => void handleImport()}
                  type="button"
                >
                  {isImporting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  {isImporting ? "Importing stock..." : "Import stock"}
                </Button>
              </div>
            </div>
          ) : null}

          {summary ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
              <p className="font-semibold">Import completed</p>
              <p className="mt-1">
                {summary.importedRows} rows imported, {summary.totalUnitsAdded} units added,{" "}
                {summary.batchesCreated} batches created, {summary.batchesUpdated} batches updated.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white/95">
          {summary ? (
            <Button type="button" variant="secondary" onClick={close}>
              Close
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={close}
                disabled={phase === "importing"}
              >
                Cancel
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
