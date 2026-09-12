import {
  CheckCircle2,
  Clock3,
  History,
  LoaderCircle,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Truck,
  TriangleAlert
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ReturnReportDialog } from "@/components/receiving/ReturnReportDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listRestockOrders,
  receiveRestockOrder,
  type RestockOrder,
  type RestockOrderLine,
  type RestockOrderStatus,
  type RestockReceiptLineInput
} from "@/services/restockApi";
import { hasRestockReturnItems } from "@/utils/restockReturnExport";

const READY_STATUSES: RestockOrderStatus[] = ["APPROVED", "AWAITING_DELIVERY"];
const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila"
});

type ReceivingView = "ready" | "partial" | "history";
type ReceiptMode = "complete" | "issues" | "partial";
type ReceiptRowState = {
  batchCode: string;
  confirmOverDelivery: boolean;
  damagedQuantity: string;
  deliveredQuantity: string;
  expiresAt: string;
  noExpiration: boolean;
};

type QueueState = {
  history: RestockOrder[];
  historyTotal: number;
  partial: RestockOrder[];
  partialTotal: number;
  ready: RestockOrder[];
  readyTotal: number;
};

const EMPTY_QUEUE: QueueState = {
  history: [],
  historyTotal: 0,
  partial: [],
  partialTotal: 0,
  ready: [],
  readyTotal: 0
};

function selectedLines(order: RestockOrder) {
  return order.lines.filter((line) => line.isSelected && line.requestedQuantity > 0);
}

function remainingQuantity(line: RestockOrderLine) {
  return Math.max(0, line.requestedQuantity - line.receivedQuantity);
}

function orderTotals(order: RestockOrder) {
  const lines = selectedLines(order);
  return {
    accepted: lines.reduce((sum, line) => sum + line.receivedQuantity, 0),
    products: lines.length,
    remaining: lines.reduce((sum, line) => sum + remainingQuantity(line), 0),
    units: lines.reduce((sum, line) => sum + line.requestedQuantity, 0)
  };
}

function statusLabel(status: RestockOrderStatus) {
  switch (status) {
    case "APPROVED":
      return "Ready to receive";
    case "AWAITING_DELIVERY":
      return "Awaiting delivery";
    case "PARTIALLY_RECEIVED":
      return "Partially received";
    case "RECEIVED":
      return "Received";
    case "DRAFT":
      return "Draft";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function statusVariant(status: RestockOrderStatus) {
  if (status === "RECEIVED") return "success" as const;
  if (status === "PARTIALLY_RECEIVED" || status === "AWAITING_DELIVERY") return "warning" as const;
  return "info" as const;
}

function internalBatchReference(order: RestockOrder, line: RestockOrderLine) {
  return `${order.orderNumber}-${line.product.sku}`.slice(0, 80);
}

function asWholeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function acceptedQuantity(row: ReceiptRowState) {
  return Math.max(0, asWholeNumber(row.deliveredQuantity) - asWholeNumber(row.damagedQuantity));
}

function initialReceiptRows(order: RestockOrder) {
  return Object.fromEntries(
    selectedLines(order)
      .filter((line) => remainingQuantity(line) > 0)
      .map((line) => {
        const remaining = remainingQuantity(line);
        return [
          line.id,
          {
            batchCode: internalBatchReference(order, line),
            confirmOverDelivery: false,
            damagedQuantity: "0",
            deliveredQuantity: String(remaining),
            expiresAt: "",
            noExpiration: true
          } satisfies ReceiptRowState
        ];
      })
  ) as Record<string, ReceiptRowState>;
}

export function ReceivingPage() {
  const { pushToast } = useToast();
  const [queue, setQueue] = useState<QueueState>(EMPTY_QUEUE);
  const [view, setView] = useState<ReceivingView>("ready");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<RestockOrder | null>(null);
  const [receiptMode, setReceiptMode] = useState<ReceiptMode | null>(null);
  const [receiptRows, setReceiptRows] = useState<Record<string, ReceiptRowState>>({});
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLotDetails, setShowLotDetails] = useState(false);
  const [returnReportOrder, setReturnReportOrder] = useState<RestockOrder | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [readyResult, partialResult, historyResult] = await Promise.all([
        listRestockOrders({ page: 1, pageSize: 100, statuses: READY_STATUSES }),
        listRestockOrders({ page: 1, pageSize: 100, status: "PARTIALLY_RECEIVED" }),
        listRestockOrders({ page: 1, pageSize: 100, status: "RECEIVED" })
      ]);

      setQueue({
        history: historyResult.items,
        historyTotal: historyResult.meta.totalItems,
        partial: partialResult.items,
        partialTotal: partialResult.meta.totalItems,
        ready: readyResult.items,
        readyTotal: readyResult.meta.totalItems
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Restock delivery tickets could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const visibleOrders =
    view === "ready" ? queue.ready : view === "partial" ? queue.partial : queue.history;
  const visibleTotal =
    view === "ready"
      ? queue.readyTotal
      : view === "partial"
        ? queue.partialTotal
        : queue.historyTotal;

  const selectedTotals = useMemo(
    () => (selectedOrder ? orderTotals(selectedOrder) : null),
    [selectedOrder]
  );

  function openTicket(order: RestockOrder) {
    setSelectedOrder(order);
    setReceiptMode(null);
    setReceiptRows(initialReceiptRows(order));
    setReceiptError(null);
    setShowLotDetails(false);
  }

  function startReceipt(mode: ReceiptMode) {
    if (!selectedOrder) return;
    setReceiptMode(mode);
    setReceiptRows(initialReceiptRows(selectedOrder));
    setReceiptError(null);
    setShowLotDetails(false);
  }

  function updateRow(lineId: string, update: (row: ReceiptRowState) => ReceiptRowState) {
    setReceiptRows((current) => {
      const row = current[lineId];
      if (!row) return current;
      return { ...current, [lineId]: update(row) };
    });
    setReceiptError(null);
  }

  function markEntireDeliveryDamaged() {
    if (!selectedOrder) return;
    setReceiptRows((current) => {
      const next = { ...current };
      for (const line of selectedLines(selectedOrder)) {
        const row = next[line.id];
        if (!row) continue;
        const remaining = remainingQuantity(line);
        next[line.id] = {
          ...row,
          damagedQuantity: String(remaining),
          deliveredQuantity: String(remaining)
        };
      }
      return next;
    });
    setReceiptError(null);
  }

  function buildReceiptPayload(order: RestockOrder) {
    const lines: RestockReceiptLineInput[] = [];
    let hasDamage = false;
    let hasPartialDifference = false;

    for (const line of selectedLines(order)) {
      const row = receiptRows[line.id];
      if (!row) continue;
      const remaining = remainingQuantity(line);
      const delivered = asWholeNumber(row.deliveredQuantity);
      const damaged = asWholeNumber(row.damagedQuantity);
      const accepted = acceptedQuantity(row);

      if (damaged > delivered) {
        throw new Error(`${line.product.name}: damaged units cannot exceed delivered units.`);
      }
      if (receiptMode === "issues" && delivered !== remaining) {
        throw new Error(
          `${line.product.name}: use Partial delivery when the delivered quantity is short.`
        );
      }
      if (delivered !== remaining || damaged > 0) hasPartialDifference = true;
      if (damaged > 0) hasDamage = true;
      if (delivered === 0) continue;
      if (accepted > 0 && !row.batchCode.trim()) {
        throw new Error(
          `${line.product.name}: keep an internal batch reference or enter the supplier lot.`
        );
      }
      if (accepted > 0 && !row.noExpiration && !row.expiresAt) {
        throw new Error(`${line.product.name}: choose an expiry date or mark no expiry printed.`);
      }
      if (accepted > remaining && !row.confirmOverDelivery) {
        throw new Error(
          `${line.product.name}: confirm the over-delivery before accepting extra units.`
        );
      }

      lines.push({
        acceptedQuantity: accepted,
        batchCode: accepted > 0 ? row.batchCode.trim() : null,
        confirmOverDelivery: row.confirmOverDelivery,
        damagedQuantity: damaged,
        deliveredQuantity: delivered,
        expiresAt: accepted > 0 && !row.noExpiration ? row.expiresAt : null,
        lineId: line.id,
        noExpiration: accepted === 0 ? true : row.noExpiration
      });
    }

    if (lines.length === 0) {
      throw new Error("Record at least one delivered unit before confirming this delivery.");
    }
    if (receiptMode === "issues" && !hasDamage) {
      throw new Error("Enter the damaged quantity, or choose Complete — No issues instead.");
    }
    if (receiptMode === "partial" && !hasPartialDifference) {
      throw new Error(
        "Adjust a delivered or damaged quantity, or choose Complete — No issues instead."
      );
    }

    return lines;
  }

  async function confirmReceipt() {
    if (!selectedOrder || !receiptMode || saving) return;
    setSaving(true);
    setReceiptError(null);

    try {
      const lines = buildReceiptPayload(selectedOrder);
      const updated = await receiveRestockOrder(selectedOrder.id, {
        expectedVersion: selectedOrder.version,
        lines
      });
      const hasReturns = hasRestockReturnItems(updated);

      setSelectedOrder(updated);
      setReceiptMode(null);
      setReceiptRows(initialReceiptRows(updated));
      setShowLotDetails(false);
      pushToast({
        title: updated.status === "RECEIVED" ? "Delivery completed" : "Delivery recorded",
        message: hasReturns
          ? `${updated.orderNumber}: accepted stock is updated. Damaged items are ready for a Return Report.`
          : `${updated.orderNumber}: only accepted physical units were added to Inventory.`,
        variant: "success"
      });
      await loadQueue();
    } catch (requestError) {
      setReceiptError(
        requestError instanceof Error ? requestError.message : "The delivery could not be recorded."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Inventory"
        title="Receiving"
        description="Open an approved restock ticket, compare it with the physical delivery, and record only the exceptions. Accepted units are the only units added to Inventory."
        actions={
          <Button
            disabled={loading}
            onClick={() => void loadQueue()}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Receiving needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <QueueSummaryCard
          active={view === "ready"}
          icon={Truck}
          label="Awaiting delivery"
          onClick={() => setView("ready")}
          value={queue.readyTotal}
        />
        <QueueSummaryCard
          active={view === "partial"}
          icon={Clock3}
          label="Partial deliveries"
          onClick={() => setView("partial")}
          value={queue.partialTotal}
        />
        <QueueSummaryCard
          active={view === "history"}
          icon={History}
          label="Received history"
          onClick={() => setView("history")}
          value={queue.historyTotal}
        />
      </section>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {view === "ready"
                  ? "Restock tickets ready for delivery"
                  : view === "partial"
                    ? "Partial deliveries"
                    : "Received tickets"}
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                {view === "ready"
                  ? "Approved tickets appear here automatically. No product search or manual stock-in is needed."
                  : view === "partial"
                    ? "Reopen the same ticket when the remaining replacement or missing items arrive."
                    : "Completed tickets stay available for delivery history and return documents."}
              </p>
            </div>
            <Badge>{visibleTotal.toLocaleString()} tickets</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading && visibleOrders.length === 0 ? (
            <div className="rounded-lg border border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Loading restock tickets…
            </div>
          ) : null}

          {!loading && visibleOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center">
              <PackageOpen aria-hidden="true" className="mx-auto h-9 w-9 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-950">
                {view === "ready"
                  ? "No deliveries are waiting."
                  : view === "partial"
                    ? "No partial deliveries."
                    : "No completed deliveries yet."}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {view === "ready"
                  ? "When a restock is confirmed in Reports, its ticket will appear here."
                  : "Receiving history updates automatically as physical deliveries are recorded."}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            {visibleOrders.map((order) => {
              const totals = orderTotals(order);
              const hasReturn = hasRestockReturnItems(order);
              return (
                <article
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between"
                  key={order.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Truck aria-hidden="true" className="h-4 w-4 text-indigo-600" />
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {order.orderNumber}
                      </p>
                      <Badge variant={statusVariant(order.status)}>
                        {statusLabel(order.status)}
                      </Badge>
                      {hasReturn ? <Badge variant="warning">Return items</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {totals.products.toLocaleString()} product{totals.products === 1 ? "" : "s"} ·{" "}
                      {totals.units.toLocaleString()} units expected ·{" "}
                      {totals.accepted.toLocaleString()} accepted
                      {totals.remaining > 0
                        ? ` · ${totals.remaining.toLocaleString()} remaining`
                        : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {order.approvedAt
                        ? `Approved ${dateFormatter.format(new Date(order.approvedAt))}`
                        : "Approved ticket"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasReturn ? (
                      <Button
                        onClick={() => setReturnReportOrder(order)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        <RotateCcw aria-hidden="true" className="h-4 w-4" />
                        Return report
                      </Button>
                    ) : null}
                    <Button onClick={() => openTicket(order)} size="sm" type="button">
                      {order.status === "RECEIVED" ? "View delivery" : "Open delivery"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>

          {visibleTotal > visibleOrders.length ? (
            <p className="mt-3 text-xs text-slate-500">
              Showing the latest {visibleOrders.length.toLocaleString()} of{" "}
              {visibleTotal.toLocaleString()} tickets.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setSelectedOrder(null);
            setReceiptMode(null);
            setReceiptRows({});
            setReceiptError(null);
            setShowLotDetails(false);
          }
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-24px)] max-w-[980px] flex-col overflow-hidden p-0">
          {selectedOrder && selectedTotals ? (
            <>
              <DialogHeader className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>{selectedOrder.orderNumber}</DialogTitle>
                  <Badge variant={statusVariant(selectedOrder.status)}>
                    {statusLabel(selectedOrder.status)}
                  </Badge>
                </div>
                <DialogDescription>
                  {selectedTotals.products.toLocaleString()} products ·{" "}
                  {selectedTotals.units.toLocaleString()} expected units ·{" "}
                  {selectedTotals.accepted.toLocaleString()} already accepted
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {receiptError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Delivery needs attention</AlertTitle>
                    <AlertDescription>{receiptError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    <span>Product</span>
                    <span className="text-right">Expected</span>
                    <span className="text-right">Remaining</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selectedLines(selectedOrder).map((line) => (
                      <div
                        className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 px-3 py-3 text-sm"
                        key={line.id}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-950">{line.product.name}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {line.product.sku}
                          </p>
                        </div>
                        <span className="text-right font-medium text-slate-700">
                          {line.requestedQuantity.toLocaleString()}
                        </span>
                        <span className="text-right font-semibold text-slate-950">
                          {remainingQuantity(line).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.status === "RECEIVED" ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-0.5 h-5 w-5 text-emerald-600"
                      />
                      <div>
                        <p className="font-semibold text-emerald-950">Delivery completed</p>
                        <p className="mt-1 text-sm leading-6 text-emerald-800">
                          This ticket has no remaining ordered quantity. Accepted units are already
                          reflected in Inventory.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : receiptMode === null ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      How did this delivery arrive?
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Choose the normal case first. Detailed fields appear only when something is
                      different.
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <ArrivalChoice
                        description="Everything remaining on the ticket arrived with no damaged units."
                        icon={CheckCircle2}
                        onClick={() => startReceipt("complete")}
                        title="Complete — No issues"
                      />
                      <ArrivalChoice
                        description="All expected units arrived, but one or more products are damaged."
                        icon={TriangleAlert}
                        onClick={() => startReceipt("issues")}
                        title="Complete — With issues"
                      />
                      <ArrivalChoice
                        description="Some products or quantities have not arrived yet."
                        icon={Clock3}
                        onClick={() => startReceipt("partial")}
                        title="Partial delivery"
                      />
                    </div>
                  </div>
                ) : (
                  <ReceiptEditor
                    mode={receiptMode}
                    onMarkAllDamaged={markEntireDeliveryDamaged}
                    onToggleLotDetails={() => setShowLotDetails((current) => !current)}
                    onUpdateRow={updateRow}
                    order={selectedOrder}
                    rows={receiptRows}
                    showLotDetails={showLotDetails}
                  />
                )}

                {hasRestockReturnItems(selectedOrder) ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-amber-950">
                        Damaged or rejected units recorded
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        Generate the supplier return document for only the affected units. The rest
                        of the ticket stays intact.
                      </p>
                    </div>
                    <Button
                      onClick={() => setReturnReportOrder(selectedOrder)}
                      type="button"
                      variant="secondary"
                    >
                      <RotateCcw aria-hidden="true" className="h-4 w-4" />
                      Download return report
                    </Button>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
                {receiptMode ? (
                  <>
                    <Button
                      disabled={saving}
                      onClick={() => {
                        setReceiptMode(null);
                        setReceiptRows(initialReceiptRows(selectedOrder));
                        setReceiptError(null);
                        setShowLotDetails(false);
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Back
                    </Button>
                    <Button disabled={saving} onClick={() => void confirmReceipt()} type="button">
                      {saving ? (
                        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                      ) : (
                        <Truck aria-hidden="true" className="h-4 w-4" />
                      )}
                      {saving
                        ? "Recording…"
                        : receiptMode === "complete"
                          ? "Confirm complete delivery"
                          : "Confirm delivery"}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setSelectedOrder(null)} type="button" variant="secondary">
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ReturnReportDialog
        onOpenChange={(open) => {
          if (!open) setReturnReportOrder(null);
        }}
        open={Boolean(returnReportOrder)}
        order={returnReportOrder}
      />
    </div>
  );
}

function QueueSummaryCard({
  active,
  icon: Icon,
  label,
  onClick,
  value
}: {
  active: boolean;
  icon: typeof Truck;
  label: string;
  onClick: () => void;
  value: number;
}) {
  return (
    <button
      className={`rounded-lg border p-4 text-left transition-colors ${
        active
          ? "border-indigo-300 bg-indigo-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
      }`}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-md bg-white p-2 shadow-sm">
          <Icon aria-hidden="true" className="h-5 w-5 text-indigo-600" />
        </div>
        <span className="text-2xl font-semibold text-slate-950">{value.toLocaleString()}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{label}</p>
    </button>
  );
}

function ArrivalChoice({
  description,
  icon: Icon,
  onClick,
  title
}: {
  description: string;
  icon: typeof Truck;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-5 w-5 text-indigo-600" />
        <p className="font-semibold text-slate-950">{title}</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </button>
  );
}

function ReceiptEditor({
  mode,
  onMarkAllDamaged,
  onToggleLotDetails,
  onUpdateRow,
  order,
  rows,
  showLotDetails
}: {
  mode: ReceiptMode;
  onMarkAllDamaged: () => void;
  onToggleLotDetails: () => void;
  onUpdateRow: (lineId: string, update: (row: ReceiptRowState) => ReceiptRowState) => void;
  order: RestockOrder;
  rows: Record<string, ReceiptRowState>;
  showLotDetails: boolean;
}) {
  const remainingLines = selectedLines(order).filter((line) => remainingQuantity(line) > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-indigo-950">
            {mode === "complete"
              ? "Complete delivery — no issues"
              : mode === "issues"
                ? "Complete delivery — record damaged units"
                : "Partial delivery — adjust only what is different"}
          </p>
          <p className="mt-1 text-xs leading-5 text-indigo-800">
            Accepted quantity is calculated automatically. You never need to type it manually.
          </p>
        </div>
        {mode === "issues" ? (
          <Button onClick={onMarkAllDamaged} size="sm" type="button" variant="secondary">
            Mark entire delivery damaged
          </Button>
        ) : null}
      </div>

      {mode === "complete" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-950">
            {remainingLines
              .reduce((sum, line) => sum + remainingQuantity(line), 0)
              .toLocaleString()}{" "}
            units will be accepted
          </p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            All remaining quantities on this ticket will be received with zero damaged units.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {remainingLines.map((line) => {
            const row = rows[line.id];
            if (!row) return null;
            const remaining = remainingQuantity(line);
            const accepted = acceptedQuantity(row);
            return (
              <div className="rounded-lg border border-slate-200 bg-white p-4" key={line.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {line.product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {line.product.sku} · {remaining.toLocaleString()} remaining
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:w-[360px]">
                    <QuantityField
                      disabled={mode === "issues"}
                      label="Delivered"
                      onChange={(value) =>
                        onUpdateRow(line.id, (current) => ({
                          ...current,
                          deliveredQuantity: value
                        }))
                      }
                      value={row.deliveredQuantity}
                    />
                    <QuantityField
                      label="Damaged"
                      onChange={(value) =>
                        onUpdateRow(line.id, (current) => ({ ...current, damagedQuantity: value }))
                      }
                      value={row.damagedQuantity}
                    />
                    <div>
                      <Label className="text-xs">Accepted</Label>
                      <div className="mt-1 flex h-10 items-center justify-end rounded-md bg-emerald-50 px-3 text-sm font-semibold text-emerald-800">
                        {accepted.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                {accepted > remaining ? (
                  <label className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    <input
                      checked={row.confirmOverDelivery}
                      className="mt-0.5"
                      onChange={(event) =>
                        onUpdateRow(line.id, (current) => ({
                          ...current,
                          confirmOverDelivery: event.target.checked
                        }))
                      }
                      type="checkbox"
                    />
                    Confirm over-delivery: accept {accepted.toLocaleString()} although only{" "}
                    {remaining.toLocaleString()} remain on the ticket.
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Supplier lot / expiry details</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Optional for the normal flow. Internal ticket references are used unless the supplier
              printed a specific lot or expiry.
            </p>
          </div>
          <Button onClick={onToggleLotDetails} size="sm" type="button" variant="secondary">
            {showLotDetails ? "Hide details" : "Add details"}
          </Button>
        </div>

        {showLotDetails ? (
          <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
            {remainingLines.map((line) => {
              const row = rows[line.id];
              if (!row || acceptedQuantity(row) === 0) return null;
              return (
                <div
                  className="grid gap-3 rounded-md bg-white p-3 md:grid-cols-[1fr_220px]"
                  key={line.id}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{line.product.name}</p>
                    <Label className="mt-2 block text-xs">Batch / lot reference</Label>
                    <Input
                      className="mt-1"
                      maxLength={80}
                      onChange={(event) =>
                        onUpdateRow(line.id, (current) => ({
                          ...current,
                          batchCode: event.target.value
                        }))
                      }
                      value={row.batchCode}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Expiration date</Label>
                    <Input
                      className="mt-1"
                      disabled={row.noExpiration}
                      onChange={(event) =>
                        onUpdateRow(line.id, (current) => ({
                          ...current,
                          expiresAt: event.target.value
                        }))
                      }
                      type="date"
                      value={row.expiresAt}
                    />
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        checked={row.noExpiration}
                        onChange={(event) =>
                          onUpdateRow(line.id, (current) => ({
                            ...current,
                            expiresAt: event.target.checked ? "" : current.expiresAt,
                            noExpiration: event.target.checked
                          }))
                        }
                        type="checkbox"
                      />
                      No expiry printed / not applicable
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuantityField({
  disabled = false,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        className="mt-1 text-right"
        disabled={disabled}
        inputMode="numeric"
        min="0"
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
    </div>
  );
}
