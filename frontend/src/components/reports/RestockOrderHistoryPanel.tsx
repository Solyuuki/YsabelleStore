import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  PackageCheck,
  Printer,
  RefreshCw
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  listRestockOrders,
  type RestockOrder,
  type RestockOrderStatus
} from "@/services/restockApi";
import {
  downloadRestockSupplierCsv,
  printRestockSupplierCopy,
  type RestockSupplierSnapshot
} from "@/utils/restockExport";

const ORDER_PAGE_SIZE = 6;

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila"
});

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type ExportBusy = "csv" | "pdf" | "print" | null;

function statusLabel(status: RestockOrderStatus) {
  switch (status) {
    case "DRAFT":
      return "Saved for later";
    case "APPROVED":
      return "Confirmed";
    case "AWAITING_DELIVERY":
      return "Awaiting delivery";
    case "PARTIALLY_RECEIVED":
      return "Partially received";
    case "RECEIVED":
      return "Received";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function statusVariant(status: RestockOrderStatus) {
  if (status === "APPROVED" || status === "RECEIVED") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "AWAITING_DELIVERY" || status === "PARTIALLY_RECEIVED") {
    return "warning" as const;
  }
  return "info" as const;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

function selectedOrderLines(order: RestockOrder) {
  return order.lines.filter((line) => line.isSelected && line.requestedQuantity > 0);
}

function orderTotals(order: RestockOrder) {
  const lines = selectedOrderLines(order);
  return {
    products: lines.length,
    units: lines.reduce((sum, line) => sum + line.requestedQuantity, 0)
  };
}

function buildSupplierSnapshot(order: RestockOrder): RestockSupplierSnapshot | null {
  if (order.status === "DRAFT" || order.status === "CANCELLED") return null;

  const lines = selectedOrderLines(order).map((line) => ({
    barcode: line.product.barcode,
    notes: line.notes ?? null,
    productName: line.product.name,
    quantity: line.requestedQuantity,
    sku: line.product.sku
  }));

  if (lines.length === 0) return null;

  return {
    generatedAt: new Date().toISOString(),
    lines,
    notes: order.notes,
    orderNumber: order.orderNumber,
    preparedBy: order.approvedBy?.name ?? order.createdBy?.name ?? null,
    statusLabel: statusLabel(order.status)
  };
}

export function RestockOrderHistoryPanel({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [orders, setOrders] = useState<RestockOrder[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<RestockOrder | null>(null);
  const [exportBusy, setExportBusy] = useState<ExportBusy>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listRestockOrders({ page, pageSize: ORDER_PAGE_SIZE });
      setOrders(result.items);
      setMeta(result.meta);

      if (result.meta.totalPages > 0 && page > result.meta.totalPages) {
        setPage(result.meta.totalPages);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Restock orders could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void refreshVersion;
    void loadOrders();
  }, [loadOrders, refreshVersion]);

  const selectedTotals = useMemo(
    () => (selectedOrder ? orderTotals(selectedOrder) : null),
    [selectedOrder]
  );
  const supplierSnapshot = useMemo(
    () => (selectedOrder ? buildSupplierSnapshot(selectedOrder) : null),
    [selectedOrder]
  );

  async function handlePdf() {
    if (!supplierSnapshot) return;
    setExportBusy("pdf");
    setExportError(null);

    try {
      const { downloadRestockSupplierPdf } = await import("@/utils/directPdfExport");
      downloadRestockSupplierPdf(supplierSnapshot);
    } catch (requestError) {
      setExportError(
        requestError instanceof Error ? requestError.message : "PDF export could not be prepared."
      );
    } finally {
      setExportBusy(null);
    }
  }

  function handlePrint() {
    if (!supplierSnapshot) return;
    setExportBusy("print");
    setExportError(null);

    try {
      if (!printRestockSupplierCopy(supplierSnapshot)) {
        setExportError("Pop-up was blocked. Allow pop-ups for Ysabelle Store and try Print again.");
      }
    } finally {
      setExportBusy(null);
    }
  }

  function handleCsv() {
    if (!supplierSnapshot) return;
    setExportBusy("csv");
    setExportError(null);

    try {
      downloadRestockSupplierCsv(supplierSnapshot);
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Restock orders</CardTitle>
              {meta ? <Badge>{meta.totalItems.toLocaleString()} saved</Badge> : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Reopen saved and confirmed restock tickets after refresh or a later session.
            </p>
          </div>
          <Button
            aria-label="Refresh restock orders"
            disabled={loading}
            onClick={() => void loadOrders()}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Orders need attention</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading && orders.length === 0 ? (
          <div className="rounded-lg border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Loading restock orders…
          </div>
        ) : null}

        {!loading && !error && orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-9 text-center">
            <PackageCheck aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-950">No restock orders yet.</p>
            <p className="mt-1 text-sm text-slate-500">
              Confirmed or saved restocks will stay available here for reopening.
            </p>
          </div>
        ) : null}

        {orders.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="hidden grid-cols-[minmax(250px,1fr)_170px_150px_120px] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400 lg:grid">
              <span>Restock order</span>
              <span>Status</span>
              <span>Order size</span>
              <span className="text-right">Action</span>
            </div>

            <div className="divide-y divide-slate-100">
              {orders.map((order) => {
                const totals = orderTotals(order);
                return (
                  <article
                    className="grid gap-3 bg-white px-3 py-3 lg:grid-cols-[minmax(250px,1fr)_170px_150px_120px] lg:items-center"
                    key={order.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {order.orderNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {order.approvedAt
                          ? `Confirmed ${formatDateTime(order.approvedAt)}`
                          : `Created ${formatDateTime(order.createdAt)}`}
                      </p>
                    </div>

                    <div>
                      <span className="mb-1 block text-xs font-medium text-slate-500 lg:hidden">
                        Status
                      </span>
                      <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
                    </div>

                    <div>
                      <span className="mb-1 block text-xs font-medium text-slate-500 lg:hidden">
                        Order size
                      </span>
                      <p className="text-sm font-medium text-slate-800">
                        {totals.products.toLocaleString()} product{totals.products === 1 ? "" : "s"} ·{" "}
                        {totals.units.toLocaleString()} units
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          setExportError(null);
                          setSelectedOrder(order);
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Open order
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {meta && meta.totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
            <Button
              aria-label="Previous restock order page"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </Button>
            <span className="min-w-[92px] text-center tabular-nums">
              Page {meta.page.toLocaleString()} of {meta.totalPages.toLocaleString()}
            </span>
            <Button
              aria-label="Next restock order page"
              disabled={loading || page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </CardContent>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            setExportError(null);
          }
        }}
        open={Boolean(selectedOrder)}
      >
        <DialogContent className="max-w-[820px]">
          {selectedOrder && selectedTotals ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedOrder.orderNumber}</DialogTitle>
                <DialogDescription>
                  Persisted restock order. Reopening or exporting this record does not change physical
                  inventory.
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[62vh] space-y-4 overflow-y-auto px-6 pb-2">
                <div className="grid gap-3 sm:grid-cols-3">
                  <OrderSummaryValue label="Status" value={statusLabel(selectedOrder.status)} />
                  <OrderSummaryValue label="Products" value={selectedTotals.products} />
                  <OrderSummaryValue label="Total units" value={selectedTotals.units} />
                </div>

                <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
                  <OrderMeta label="Created" value={formatDateTime(selectedOrder.createdAt)} />
                  <OrderMeta label="Confirmed" value={formatDateTime(selectedOrder.approvedAt)} />
                  <OrderMeta
                    label="Prepared by"
                    value={
                      selectedOrder.approvedBy?.name ?? selectedOrder.createdBy?.name ?? "Not recorded"
                    }
                  />
                  <OrderMeta label="Version" value={selectedOrder.version.toLocaleString()} />
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400 sm:grid-cols-[150px_minmax(0,1fr)_120px]">
                    <span className="hidden sm:block">SKU</span>
                    <span>Product</span>
                    <span className="text-right">Order qty</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selectedOrderLines(selectedOrder).map((line) => (
                      <div
                        className="grid grid-cols-[minmax(0,1fr)_110px] gap-3 px-3 py-3 sm:grid-cols-[150px_minmax(0,1fr)_120px]"
                        key={line.id}
                      >
                        <span className="hidden truncate text-xs text-slate-500 sm:block">
                          {line.product.sku}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {line.product.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500 sm:hidden">
                            {line.product.sku}
                          </p>
                          {line.notes ? (
                            <p className="mt-1 text-xs leading-5 text-slate-500">{line.notes}</p>
                          ) : null}
                        </div>
                        <span className="text-right text-sm font-semibold text-slate-950">
                          {line.requestedQuantity.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.notes ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Order note</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{selectedOrder.notes}</p>
                  </div>
                ) : null}

                <Alert>
                  <AlertTitle>Physical inventory remains unchanged</AlertTitle>
                  <AlertDescription>
                    This is the saved order record only. Stock increases only when actual receiving is
                    performed in the delivery workflow.
                  </AlertDescription>
                </Alert>

                {supplierSnapshot ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Button
                      disabled={exportBusy !== null}
                      onClick={() => void handlePdf()}
                      type="button"
                    >
                      <FileDown aria-hidden="true" className="h-4 w-4" />
                      {exportBusy === "pdf" ? "Preparing…" : "Download PDF"}
                    </Button>
                    <Button
                      disabled={exportBusy !== null}
                      onClick={handlePrint}
                      type="button"
                      variant="secondary"
                    >
                      <Printer aria-hidden="true" className="h-4 w-4" />
                      {exportBusy === "print" ? "Preparing…" : "Print"}
                    </Button>
                    <Button
                      disabled={exportBusy !== null}
                      onClick={handleCsv}
                      type="button"
                      variant="secondary"
                    >
                      <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />
                      {exportBusy === "csv" ? "Preparing…" : "Excel-compatible CSV"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-slate-500">
                    Supplier export becomes available after a restock is confirmed. Draft and cancelled
                    orders remain reopenable here as records.
                  </p>
                )}

                {exportError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Export needs attention</AlertTitle>
                    <AlertDescription>{exportError}</AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Close
                  </Button>
                </DialogClose>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function OrderSummaryValue({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function OrderMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 truncate font-medium text-slate-900">{value}</p>
    </div>
  );
}
