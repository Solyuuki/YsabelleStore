import {
  AlertTriangle,
  Database,
  Eye,
  FileClock,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Upload
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { HistoricalSalesImportDialog } from "@/components/historical-sales/HistoricalSalesImportDialog";
import { AppPagination } from "@/components/shared/AppPagination";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/useToast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  getHistoricalSalesBatch,
  getHistoricalSalesEligibility,
  listHistoricalSalesBatches,
  listHistoricalSalesRows,
  previewHistoricalSalesRollback,
  refreshHistoricalSalesForecasts,
  rollbackHistoricalSales
} from "@/services/historicalSalesService";
import type {
  EligibilityResponse,
  HistoricalSalesAuditRow,
  HistoricalSalesBatch,
  Paginated,
  RollbackImpact
} from "@/types/historicalSales";

type Tab = "overview" | "history";

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function HistoricalSalesPage() {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [importOpen, setImportOpen] = useState(false);
  const [history, setHistory] = useState<Paginated<HistoricalSalesBatch> | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [eligibilityPage, setEligibilityPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const overviewRequestSequence = useRef(0);
  const overviewAbortController = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    overviewAbortController.current?.abort();
    const controller = new AbortController();
    const requestId = ++overviewRequestSequence.current;
    overviewAbortController.current = controller;
    setLoading(true);
    setError(null);
    try {
      const [historyResponse, eligibilityResponse] = await Promise.all([
        listHistoricalSalesBatches(historyPage, 20, controller.signal),
        getHistoricalSalesEligibility(eligibilityPage, 20, controller.signal)
      ]);
      if (requestId !== overviewRequestSequence.current) return;
      if (!historyResponse.success || !historyResponse.data)
        throw new Error(historyResponse.message);
      if (!eligibilityResponse.success || !eligibilityResponse.data)
        throw new Error(eligibilityResponse.message);
      setHistory(historyResponse.data);
      setEligibility(eligibilityResponse.data);
    } catch (loadError) {
      if (requestId !== overviewRequestSequence.current || isAbortError(loadError)) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Historical sales data could not be loaded."
      );
    } finally {
      if (requestId === overviewRequestSequence.current) {
        setLoading(false);
      }
    }
  }, [eligibilityPage, historyPage]);

  useEffect(() => {
    void load();
    return () => {
      overviewAbortController.current?.abort();
      overviewRequestSequence.current += 1;
    };
  }, [load]);

  function handleImported() {
    pushToast({
      title: "Historical sales imported",
      message: "The batch was committed and its audit log is available.",
      variant: "success"
    });
    setTab("history");
    void load();
  }

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => setImportOpen(true)} type="button">
            <Upload className="h-4 w-4" /> New import
          </Button>
        }
        description="Manage approved monthly sales history, audit import batches, and assess SARIMA readiness without changing products, inventory, or POS transactions."
        eyebrow="Forecast data"
        title="Historical Sales"
      />

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
          <Database className="h-4 w-4" /> Data overview
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          <FileClock className="h-4 w-4" /> Import history
        </TabButton>
      </div>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertTitle>Historical sales unavailable</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button onClick={() => void load()} size="sm" type="button" variant="secondary">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {loading && !history ? (
        <div className="mt-4">
          <LoadingState
            label="Loading historical sales data"
            helper="Reading import history and effective monthly-series eligibility."
          />
        </div>
      ) : null}
      {loading && history ? (
        <p
          aria-live="polite"
          className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500"
        >
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Updating historical sales data
        </p>
      ) : null}

      {tab === "overview" && eligibility ? (
        <section className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewCard
              label="SARIMA eligible"
              value={eligibility.counts.ELIGIBLE ?? 0}
              tone="success"
            />
            <OverviewCard
              label="Limited history"
              value={eligibility.counts.LIMITED_HISTORY ?? 0}
              tone="warning"
            />
            <OverviewCard
              label="Insufficient history"
              value={eligibility.counts.INSUFFICIENT_HISTORY ?? 0}
            />
            <OverviewCard
              label="Data quality issue"
              value={eligibility.counts.DATA_QUALITY_ISSUE ?? 0}
              tone="danger"
            />
          </div>
          <Alert>
            <AlertTitle>Effective-series precedence</AlertTitle>
            <AlertDescription>
              Completed POS sales are authoritative for a product-month. Active imported history is
              used only when no completed POS month exists. Development fixtures are excluded from
              production forecasting.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>SARIMA eligibility by product</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Observations</TableHead>
                      <TableHead className="text-right">Missing months</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assessment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibility.items.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-slate-500">{item.productId}</p>
                        </TableCell>
                        <TableCell className="text-right">{item.observationCount}</TableCell>
                        <TableCell className="text-right">{item.missingMonths.length}</TableCell>
                        <TableCell>
                          <EligibilityBadge status={item.status} />
                        </TableCell>
                        <TableCell className="max-w-md text-sm text-slate-600">
                          {item.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {eligibility.items.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  No catalog products are available for eligibility assessment.
                </p>
              ) : null}
              <AppPagination
                className="mt-4"
                itemLabel="products"
                onPageChange={setEligibilityPage}
                page={eligibility.page}
                pageSize={eligibility.pageSize}
                totalItems={eligibility.totalItems}
                totalPages={eligibility.totalPages}
              />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {tab === "history" && history ? (
        <section className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle>Import batches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Imported</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                      <TableHead className="text-right">Written</TableHead>
                      <TableHead className="text-right">Skipped</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.items.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <p className="font-medium">{batch.batchCode}</p>
                          <p className="max-w-48 truncate text-xs text-slate-500">
                            {batch.originalFileName}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p>{formatDate(batch.createdAt)}</p>
                          <p className="text-xs text-slate-500">{batch.importedBy.name}</p>
                        </TableCell>
                        <TableCell className="text-xs">{friendly(batch.importMode)}</TableCell>
                        <TableCell className="text-right">{batch.totalRows}</TableCell>
                        <TableCell className="text-right">{batch.importedRows}</TableCell>
                        <TableCell className="text-right">{batch.skippedRows}</TableCell>
                        <TableCell>
                          <BatchBadge status={batch.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => setSelectedBatchId(batch.id)}
                            size="sm"
                            type="button"
                            variant="secondary"
                          >
                            <Eye className="h-4 w-4" /> Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {history.items.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">
                  No historical sales imports have been previewed yet.
                </p>
              ) : null}
              <AppPagination
                className="mt-4"
                itemLabel="batches"
                onPageChange={setHistoryPage}
                page={history.page}
                pageSize={history.pageSize}
                totalItems={history.totalItems}
                totalPages={history.totalPages}
              />
            </CardContent>
          </Card>
        </section>
      ) : null}

      <HistoricalSalesImportDialog
        open={importOpen}
        onImported={handleImported}
        onOpenChange={setImportOpen}
      />
      <BatchDetails
        batchId={selectedBatchId}
        key={selectedBatchId ?? "closed"}
        onChanged={() => {
          setSelectedBatchId(null);
          void load();
        }}
        onClose={() => setSelectedBatchId(null)}
      />
    </>
  );
}

function BatchDetails({
  batchId,
  onChanged,
  onClose
}: {
  batchId: string | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { pushToast } = useToast();
  const [batch, setBatch] = useState<HistoricalSalesBatch | null>(null);
  const [rows, setRows] = useState<Paginated<HistoricalSalesAuditRow> | null>(null);
  const [rowPage, setRowPage] = useState(1);
  const [rowStatus, setRowStatus] = useState("");
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [impact, setImpact] = useState<RollbackImpact | null>(null);
  const [reason, setReason] = useState("");
  const [rollingBack, setRollingBack] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const detailRequestSequence = useRef(0);
  const detailAbortController = useRef<AbortController | null>(null);
  const rowsRequestSequence = useRef(0);
  const rowsAbortController = useRef<AbortController | null>(null);
  const rollbackPreviewSequence = useRef(0);
  const rollbackPreviewAbortController = useRef<AbortController | null>(null);
  const rollbackSequence = useRef(0);
  const rollbackAbortController = useRef<AbortController | null>(null);
  const refreshSequence = useRef(0);
  const refreshAbortController = useRef<AbortController | null>(null);

  const loadBatch = useCallback(async () => {
    if (!batchId) return;
    detailAbortController.current?.abort();
    const controller = new AbortController();
    const requestId = ++detailRequestSequence.current;
    detailAbortController.current = controller;
    setLoadingBatch(true);
    setError(null);
    try {
      const batchResponse = await getHistoricalSalesBatch(batchId, controller.signal);
      if (requestId !== detailRequestSequence.current) return;
      if (!batchResponse.success || !batchResponse.data) throw new Error(batchResponse.message);
      setBatch(batchResponse.data);
      setError(null);
    } catch (loadError) {
      if (requestId !== detailRequestSequence.current || isAbortError(loadError)) return;
      setError(
        loadError instanceof Error ? loadError.message : "Batch details could not be loaded."
      );
    } finally {
      if (requestId === detailRequestSequence.current) {
        setLoadingBatch(false);
      }
    }
  }, [batchId]);

  const loadRows = useCallback(async () => {
    if (!batchId) return;
    rowsAbortController.current?.abort();
    const controller = new AbortController();
    const requestId = ++rowsRequestSequence.current;
    rowsAbortController.current = controller;
    setLoadingRows(true);
    setRowsError(null);
    try {
      const response = await listHistoricalSalesRows(
        batchId,
        rowPage,
        20,
        rowStatus || undefined,
        controller.signal
      );
      if (requestId !== rowsRequestSequence.current) return;
      if (!response.success || !response.data) throw new Error(response.message);
      setRows(response.data);
      setRowsError(null);
    } catch (loadError) {
      if (requestId !== rowsRequestSequence.current || isAbortError(loadError)) return;
      setRowsError(
        loadError instanceof Error ? loadError.message : "Batch rows could not be loaded."
      );
    } finally {
      if (requestId === rowsRequestSequence.current) {
        setLoadingRows(false);
      }
    }
  }, [batchId, rowPage, rowStatus]);

  useEffect(() => {
    void loadBatch();
    return () => {
      detailAbortController.current?.abort();
      detailRequestSequence.current += 1;
    };
  }, [loadBatch]);

  useEffect(() => {
    void loadRows();
    return () => {
      rowsAbortController.current?.abort();
      rowsRequestSequence.current += 1;
    };
  }, [loadRows]);

  useEffect(
    () => () => {
      rollbackPreviewAbortController.current?.abort();
      rollbackPreviewSequence.current += 1;
      rollbackAbortController.current?.abort();
      rollbackSequence.current += 1;
      refreshAbortController.current?.abort();
      refreshSequence.current += 1;
    },
    []
  );

  async function openRollback() {
    if (!batchId) return;
    rollbackPreviewAbortController.current?.abort();
    const controller = new AbortController();
    const requestId = ++rollbackPreviewSequence.current;
    rollbackPreviewAbortController.current = controller;
    setLoadingImpact(true);
    setError(null);
    try {
      const response = await previewHistoricalSalesRollback(batchId, controller.signal);
      if (requestId !== rollbackPreviewSequence.current) return;
      if (response.success && response.data) setImpact(response.data);
      else setError(response.message);
    } catch (previewError) {
      if (requestId !== rollbackPreviewSequence.current || isAbortError(previewError)) return;
      setError("Rollback impact could not be loaded.");
    } finally {
      if (requestId === rollbackPreviewSequence.current) {
        setLoadingImpact(false);
      }
    }
  }

  async function confirmRollback() {
    if (!batchId) return;
    rollbackAbortController.current?.abort();
    const controller = new AbortController();
    const requestId = ++rollbackSequence.current;
    rollbackAbortController.current = controller;
    setRollingBack(true);
    setError(null);
    try {
      const response = await rollbackHistoricalSales(batchId, reason, controller.signal);
      if (requestId !== rollbackSequence.current) return;
      if (response.success) {
        pushToast({
          title: "Batch rolled back",
          message: "Imported records were invalidated and safe prior versions were restored.",
          variant: "success"
        });
        setImpact(null);
        onChanged();
      } else setError(response.message);
    } catch (rollbackError) {
      if (requestId !== rollbackSequence.current || isAbortError(rollbackError)) return;
      setError("Rollback failed. The active historical dataset was preserved.");
    } finally {
      if (requestId === rollbackSequence.current) {
        setRollingBack(false);
      }
    }
  }

  async function refreshForecasts() {
    if (!batchId) return;
    refreshAbortController.current?.abort();
    const controller = new AbortController();
    const requestId = ++refreshSequence.current;
    refreshAbortController.current = controller;
    setRefreshing(true);
    setError(null);
    try {
      const response = await refreshHistoricalSalesForecasts(batchId, controller.signal);
      if (requestId !== refreshSequence.current) return;
      pushToast({
        title: response.success ? "Forecasts refreshed" : "Forecast refresh failed",
        message: response.message,
        variant: response.success ? "success" : "error"
      });
    } catch (refreshError) {
      if (requestId !== refreshSequence.current || isAbortError(refreshError)) return;
      pushToast({
        title: "Forecast refresh failed",
        message: "The previous successful forecast remains available.",
        variant: "error"
      });
    } finally {
      if (requestId === refreshSequence.current) {
        setRefreshing(false);
        void loadBatch();
      }
    }
  }

  function closeRollback() {
    rollbackPreviewAbortController.current?.abort();
    rollbackPreviewSequence.current += 1;
    setLoadingImpact(false);
    setImpact(null);
  }

  return (
    <>
      <Sheet open={Boolean(batchId)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="max-w-[840px]">
          <SheetHeader>
            <SheetTitle>{batch?.batchCode ?? "Historical sales batch"}</SheetTitle>
            <SheetDescription>
              {batch
                ? `${batch.originalFileName} · ${formatDate(batch.createdAt)}`
                : "Loading batch audit details."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {loadingBatch && !batch ? <LoadingState label="Loading batch details" /> : null}
            {loadingBatch && batch ? (
              <p
                aria-live="polite"
                className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500"
              >
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Updating batch details
              </p>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Batch action unavailable</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {batch ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Meta label="Status">
                    <BatchBadge status={batch.status} />
                  </Meta>
                  <Meta label="Imported by">{batch.importedBy.name}</Meta>
                  <Meta label="Mode">{friendly(batch.importMode)}</Meta>
                  <Meta label="Forecast refresh">{friendly(batch.forecastRefreshStatus)}</Meta>
                  <Meta label="File hash">
                    <span className="break-all font-mono text-[11px]">{batch.fileHash}</span>
                  </Meta>
                  <Meta label="File size">{formatBytes(batch.fileSize)}</Meta>
                  <Meta label="Imported rows">{batch.importedRows}</Meta>
                  <Meta label="Skipped / replaced">
                    {batch.skippedRows} / {batch.replacedRows}
                  </Meta>
                </div>
                {batch.errorMessage ? (
                  <Alert variant="destructive">
                    <AlertTitle>Recorded failure</AlertTitle>
                    <AlertDescription>{batch.errorMessage}</AlertDescription>
                  </Alert>
                ) : null}
                {batch.rollbackReason ? (
                  <Alert>
                    <AlertTitle>Rollback history</AlertTitle>
                    <AlertDescription>
                      {batch.rollbackReason} ·{" "}
                      {batch.rolledBackAt ? formatDate(batch.rolledBackAt) : ""}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="flex items-end justify-between gap-4">
                  <label className="w-56 space-y-1 text-xs font-medium text-slate-600">
                    Row status
                    <Select
                      value={rowStatus}
                      onChange={(event) => {
                        setRowStatus(event.target.value);
                        setRowPage(1);
                      }}
                    >
                      <option value="">All rows</option>
                      {[
                        "IMPORTED",
                        "REPLACED",
                        "SKIPPED",
                        "INVALID",
                        "UNMATCHED",
                        "DUPLICATE",
                        "OVERLAP"
                      ].map((status) => (
                        <option key={status} value={status}>
                          {friendly(status)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <p className="text-xs text-slate-500">
                    {loadingRows ? (
                      <span aria-live="polite" className="flex items-center gap-2">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Updating rows
                      </span>
                    ) : (
                      "Rejected and skipped rows remain auditable."
                    )}
                  </p>
                </div>
                {rowsError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Batch rows unavailable</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-4">
                      <span>{rowsError}</span>
                      <Button
                        onClick={() => void loadRows()}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="max-h-80 overflow-auto rounded-md border border-slate-200">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-50">
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Identifier</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows?.items.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>
                            <p>{row.normalizedSku || "No SKU"}</p>
                            <p className="text-xs text-slate-500">
                              {row.normalizedBarcode || "No barcode"}
                            </p>
                          </TableCell>
                          <TableCell>{row.matchedProduct?.name ?? "Unmatched"}</TableCell>
                          <TableCell>{row.normalizedPeriod?.slice(0, 7) ?? "—"}</TableCell>
                          <TableCell className="text-right">{row.quantitySold ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.status === "IMPORTED" || row.status === "REPLACED"
                                  ? "success"
                                  : row.status === "SKIPPED"
                                    ? "warning"
                                    : "danger"
                              }
                            >
                              {friendly(row.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-56 text-xs text-slate-600">
                            {row.errorMessage ?? "Imported successfully"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {rows ? (
                  <AppPagination
                    itemLabel="rows"
                    onPageChange={setRowPage}
                    page={rows.page}
                    pageSize={rows.pageSize}
                    totalItems={rows.totalItems}
                    totalPages={rows.totalPages}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          <SheetFooter>
            <Button onClick={onClose} type="button" variant="secondary">
              Close
            </Button>
            {batch?.forecastRefreshStatus === "PENDING" ||
            batch?.forecastRefreshStatus === "FAILED" ? (
              <Button
                disabled={refreshing}
                onClick={() => void refreshForecasts()}
                type="button"
                variant="secondary"
              >
                {refreshing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}{" "}
                Re-run forecasts
              </Button>
            ) : null}
            {batch && ["COMPLETED", "COMPLETED_WITH_SKIPS"].includes(batch.status) ? (
              <Button
                disabled={loadingImpact}
                onClick={() => void openRollback()}
                type="button"
                variant="danger"
              >
                {loadingImpact ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}{" "}
                Roll back batch
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Dialog open={Boolean(impact)} onOpenChange={(open) => !open && closeRollback()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm historical sales rollback</DialogTitle>
            <DialogDescription>
              This invalidates only active rows from the selected batch and restores directly
              replaced imported versions when safe.
            </DialogDescription>
          </DialogHeader>
          {impact ? (
            <div className="space-y-4 px-6 pb-2">
              <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                <AlertTitle>
                  <AlertTriangle className="mr-2 inline h-4 w-4" /> Review impact
                </AlertTitle>
                <AlertDescription>
                  {impact.recordsToInvalidate} records across {impact.productsAffected} products
                  will be invalidated. {impact.recordsToRestore} prior imported versions will be
                  restored. {impact.posCoveredPeriods} periods are covered by authoritative POS
                  sales.
                </AlertDescription>
              </Alert>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Rollback reason
                <Textarea
                  maxLength={500}
                  minLength={5}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain why this batch must be rolled back..."
                  value={reason}
                />
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              disabled={rollingBack}
              onClick={closeRollback}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={rollingBack || reason.trim().length < 5}
              onClick={() => void confirmRollback()}
              type="button"
              variant="danger"
            >
              {rollingBack ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}{" "}
              Confirm rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TabButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${active ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
function OverviewCard({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
  value: number;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <Badge variant={tone}>{label}</Badge>
        <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}
function Meta({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-800">{children}</div>
    </div>
  );
}
function EligibilityBadge({
  status
}: {
  status: "ELIGIBLE" | "LIMITED_HISTORY" | "INSUFFICIENT_HISTORY" | "DATA_QUALITY_ISSUE";
}) {
  return (
    <Badge
      variant={
        status === "ELIGIBLE"
          ? "success"
          : status === "LIMITED_HISTORY"
            ? "warning"
            : status === "DATA_QUALITY_ISSUE"
              ? "danger"
              : "default"
      }
    >
      {friendly(status)}
    </Badge>
  );
}
function BatchBadge({ status }: { status: HistoricalSalesBatch["status"] }) {
  return (
    <Badge
      variant={
        status === "COMPLETED"
          ? "success"
          : status === "COMPLETED_WITH_SKIPS"
            ? "warning"
            : status === "FAILED" || status === "ROLLED_BACK"
              ? "danger"
              : "info"
      }
    >
      {friendly(status)}
    </Badge>
  );
}
function friendly(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
