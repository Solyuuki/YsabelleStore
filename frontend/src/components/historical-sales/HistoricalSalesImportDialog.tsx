import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppPagination } from "@/components/shared/AppPagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  confirmHistoricalSales,
  downloadHistoricalSalesTemplate,
  previewHistoricalSales
} from "@/services/historicalSalesService";
import type {
  HistoricalSalesImportMode,
  HistoricalSalesPreview,
  HistoricalSalesPreviewRow
} from "@/types/historicalSales";

type PreviewFilter =
  | "ALL"
  | "VALID"
  | "INVALID"
  | "UNMATCHED"
  | "DUPLICATES"
  | "OVERLAPS"
  | "WARNINGS";

export function HistoricalSalesImportDialog({
  open,
  onOpenChange,
  onImported
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<HistoricalSalesPreview | null>(null);
  const [mode, setMode] = useState<HistoricalSalesImportMode>("APPEND_ONLY");
  const [filter, setFilter] = useState<PreviewFilter>("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setMode("APPEND_ONLY");
      setFilter("ALL");
      setPage(1);
      setError(null);
    }
  }, [open]);

  const filteredRows = useMemo(
    () => (preview?.rows ?? []).filter((row) => rowMatchesFilter(row, filter)),
    [filter, preview]
  );
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  function chooseFile(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setError(null);
    setPage(1);
  }

  async function handleTemplate() {
    try {
      const csv = await downloadHistoricalSalesTemplate();
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "historical-sales-import-template.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("The historical sales template could not be downloaded.");
    }
  }

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const response = await previewHistoricalSales(file);
      if (response.success && response.data) setPreview(response.data);
      else setError(response.message || "The file could not be previewed.");
    } catch {
      setError("The file could not be previewed. Please verify that the backend is available.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!file || !preview) return;
    setConfirming(true);
    setError(null);
    try {
      const response = await confirmHistoricalSales(file, preview.previewBatchId, mode);
      if (response.success) {
        onImported();
        onOpenChange(false);
      } else setError(response.message || "The import could not be confirmed.");
    } catch {
      setError("The import could not be confirmed. No historical sales changes were committed.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !confirming && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] max-w-[1120px]">
        <DialogHeader>
          <DialogTitle>Import historical sales</DialogTitle>
          <DialogDescription>
            Preview monthly sales, match catalog products, and resolve overlaps before any data is
            written.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 pb-2">
          {error ? (
            <Alert className="mb-4" variant="destructive">
              <AlertTitle>Import could not continue</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {!preview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Canonical monthly template</p>
                  <p className="mt-1 text-xs text-slate-600">
                    SKU or barcode, period, and quantity sold are required. CSV and XLSX are
                    supported.
                  </p>
                </div>
                <Button onClick={() => void handleTemplate()} type="button" variant="secondary">
                  <Download className="h-4 w-4" /> Template
                </Button>
              </div>

              <button
                className="flex min-h-44 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center transition hover:border-emerald-400 hover:bg-emerald-50/30"
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                <Upload className="h-8 w-8 text-emerald-700" />
                <span className="mt-3 text-sm font-semibold text-slate-900">
                  Select a CSV or XLSX file
                </span>
                <span className="mt-1 text-xs text-slate-500">Maximum file size: 5 MB</span>
              </button>
              <input
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                ref={inputRef}
                type="file"
              />

              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <FileSpreadsheet className="h-8 w-8 text-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-600">
                      {formatBytes(file.size)} · Ready to preview
                    </p>
                  </div>
                  <Button onClick={() => inputRef.current?.click()} type="button" variant="ghost">
                    Replace
                  </Button>
                  <Button
                    aria-label="Remove file"
                    onClick={() => chooseFile(null)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Summary label="Total" value={preview.totalRows} />
                <Summary label="Valid" value={preview.validRows} tone="success" />
                <Summary label="Invalid" value={preview.invalidRows} tone="danger" />
                <Summary label="Unmatched" value={preview.unmatchedRows} tone="warning" />
                <Summary label="Duplicates" value={preview.duplicateRows} tone="warning" />
                <Summary label="Overlaps" value={preview.overlapRows} tone="info" />
              </div>

              {preview.posOverlapRows > 0 ? (
                <Alert>
                  <AlertTitle>POS actual sales are protected</AlertTitle>
                  <AlertDescription>
                    {preview.posOverlapRows} row(s) overlap completed POS months. They will be
                    skipped in every import mode.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-[1fr_auto] md:items-end">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Import mode
                  <Select
                    value={mode}
                    onChange={(event) => setMode(event.target.value as HistoricalSalesImportMode)}
                  >
                    <option value="APPEND_ONLY">Append only (safest)</option>
                    <option value="REJECT_ON_OVERLAP">Reject entire import on overlap</option>
                    <option value="REPLACE_IMPORTED_OVERLAPS">Replace imported overlaps</option>
                  </Select>
                </label>
                <div className="text-xs text-slate-600 md:max-w-md">
                  {mode === "APPEND_ONLY"
                    ? "Existing imported and POS months are skipped."
                    : mode === "REJECT_ON_OVERLAP"
                      ? "Any overlap blocks all writes."
                      : "Only imported overlaps are invalidated and versioned; POS months remain untouched."}
                </div>
              </div>

              {mode === "REPLACE_IMPORTED_OVERLAPS" && preview.overlapRows > 0 ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                  <AlertTitle>Replacement mode selected</AlertTitle>
                  <AlertDescription>
                    Confirming will invalidate active imported overlaps while preserving their audit
                    history. Actual POS months are never replaced.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "ALL",
                    "VALID",
                    "INVALID",
                    "UNMATCHED",
                    "DUPLICATES",
                    "OVERLAPS",
                    "WARNINGS"
                  ] as PreviewFilter[]
                ).map((item) => (
                  <Button
                    key={item}
                    onClick={() => {
                      setFilter(item);
                      setPage(1);
                    }}
                    size="sm"
                    type="button"
                    variant={filter === item ? "default" : "secondary"}
                  >
                    {item.toLowerCase()}
                  </Button>
                ))}
              </div>

              <div className="max-h-[360px] overflow-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50">
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Matched product</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>
                          <p className="font-medium">{row.sku || "No SKU"}</p>
                          <p className="text-xs text-slate-500">{row.barcode || "No barcode"}</p>
                        </TableCell>
                        <TableCell>
                          {row.matchedProduct ? (
                            <>
                              <p className="font-medium">{row.matchedProduct.name}</p>
                              <p className="text-xs text-slate-500">{row.matchedProduct.sku}</p>
                            </>
                          ) : (
                            "Unmatched"
                          )}
                        </TableCell>
                        <TableCell>{row.period ?? "Invalid"}</TableCell>
                        <TableCell className="text-right">{row.quantitySold ?? "—"}</TableCell>
                        <TableCell>
                          <RowBadge status={row.status} />
                        </TableCell>
                        <TableCell className="max-w-64 text-xs text-slate-600">
                          {row.errors[0]?.message ?? row.warnings[0]?.message ?? "Ready to import"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <AppPagination
                itemLabel="rows"
                onPageChange={setPage}
                page={page}
                pageSize={pageSize}
                totalItems={filteredRows.length}
              />
              <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                <span>{preview.productsAffected} catalog products matched</span>
                <span>{preview.sarimaEligibleProducts} SARIMA eligible after safe append</span>
                <span>{preview.productsBelowThreshold} below threshold or needing review</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={loading || confirming}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          {preview ? (
            <>
              <Button
                disabled={confirming}
                onClick={() => {
                  setPreview(null);
                  setError(null);
                }}
                type="button"
                variant="secondary"
              >
                Back
              </Button>
              <Button
                disabled={confirming || (mode === "REJECT_ON_OVERLAP" && preview.overlapRows > 0)}
                onClick={() => void handleConfirm()}
                type="button"
              >
                {confirming ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}{" "}
                Confirm import
              </Button>
            </>
          ) : (
            <Button disabled={!file || loading} onClick={() => void handlePreview()} type="button">
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}{" "}
              Preview historical sales
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function rowMatchesFilter(row: HistoricalSalesPreviewRow, filter: PreviewFilter) {
  if (filter === "ALL") return true;
  if (filter === "VALID") return row.status === "VALID" || row.status === "WARNING";
  if (filter === "INVALID") return row.status === "INVALID";
  if (filter === "UNMATCHED") return row.status === "UNMATCHED";
  if (filter === "DUPLICATES") return row.status === "DUPLICATE";
  if (filter === "OVERLAPS") return row.status === "OVERLAP";
  return row.warnings.length > 0;
}

function RowBadge({ status }: { status: HistoricalSalesPreviewRow["status"] }) {
  const variant =
    status === "VALID"
      ? "success"
      : status === "WARNING" || status === "OVERLAP"
        ? "warning"
        : "danger";
  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}

function Summary({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "default" | "success" | "danger" | "warning" | "info";
  value: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
      <Badge className="mt-2" variant={tone}>
        {label}
      </Badge>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
