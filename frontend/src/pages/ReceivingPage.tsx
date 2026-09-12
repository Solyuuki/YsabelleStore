import { Accordion } from "@base-ui/react/accordion";
import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Inbox,
  LoaderCircle,
  RotateCcw,
  Truck,
  TriangleAlert,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ReturnReportDialog } from "@/components/receiving/ReturnReportDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { useToast } from "@/components/shared/ToastProvider";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  if (status === "PARTIALLY_RECEIVED" || status === "AWAITING_DELIVERY") {
    return "warning" as const;
  }
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
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<RestockOrder | null>(null);
  const [receiptMode, setReceiptMode] = useState<ReceiptMode | null>(null);
  const [receiptRows, setReceiptRows] = useState<Record<string, ReceiptRowState>>({});
  const [exceptionLineIds, setExceptionLineIds] = useState<string[]>([]);
  const [damageReason, setDamageReason] = useState("");
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lotDialogOpen, setLotDialogOpen] = useState(false);
  const [lotLineId, setLotLineId] = useState("");
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

  const acceptedLotLines = useMemo(() => {
    if (!selectedOrder) return [];
    return selectedLines(selectedOrder).filter((line) => {
      const row = receiptRows[line.id];
      return row && acceptedQuantity(row) > 0;
    });
  }, [receiptRows, selectedOrder]);

  function changeView(next: ReceivingView) {
    setView(next);
    setExpandedTicketId(null);
  }

  function openTicket(order: RestockOrder) {
    setSelectedOrder(order);
    setReceiptMode(null);
    setReceiptRows(initialReceiptRows(order));
    setExceptionLineIds([]);
    setDamageReason("");
    setReceiptError(null);
    setLotDialogOpen(false);
    setLotLineId("");
  }

  function closeTicket() {
    if (saving) return;
    setSelectedOrder(null);
    setReceiptMode(null);
    setReceiptRows({});
    setExceptionLineIds([]);
    setDamageReason("");
    setReceiptError(null);
    setLotDialogOpen(false);
    setLotLineId("");
  }

  function startReceipt(mode: ReceiptMode) {
    if (!selectedOrder) return;
    setReceiptMode(mode);
    setReceiptRows(initialReceiptRows(selectedOrder));
    setExceptionLineIds([]);
    setDamageReason("");
    setReceiptError(null);
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

    const remainingLines = selectedLines(selectedOrder).filter(
      (line) => remainingQuantity(line) > 0
    );
    setExceptionLineIds(remainingLines.map((line) => line.id));
    setReceiptRows((current) => {
      const next = { ...current };
      for (const line of remainingLines) {
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

  function openLotDetails() {
    const firstLine = acceptedLotLines[0];
    if (!firstLine) return;
    setLotLineId((current) => current || firstLine.id);
    setLotDialogOpen(true);
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

      if (damaged > 0 && !damageReason.trim()) {
        throw new Error("Enter a damage / return reason before confirming this delivery.");
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
        damageReason: damaged > 0 ? damageReason.trim() : null,
        deliveredQuantity: delivered,
        expiresAt: accepted > 0 && !row.noExpiration ? row.expiresAt : null,
        lineId: line.id,
        noExpiration: accepted === 0 ? true : row.noExpiration
      });
    }

    if (lines.length === 0) {
      throw new Error("Record at least one delivered unit before confirming this delivery.");
    }

    if (receiptMode === "issues" && exceptionLineIds.length === 0) {
      throw new Error("Select the product or products with damaged units.");
    }

    if (receiptMode === "issues" && !hasDamage) {
      throw new Error("Enter the damaged quantity, or choose Complete — No issues instead.");
    }

    if (receiptMode === "partial" && exceptionLineIds.length === 0) {
      throw new Error("Select the product or products that did not fully arrive.");
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

      if (hasReturns) {
        setSelectedOrder(null);
        setReturnReportOrder(updated);
      } else {
        setSelectedOrder(updated);
      }
      setReceiptMode(null);
      setReceiptRows(initialReceiptRows(updated));
      setExceptionLineIds([]);
      setDamageReason("");
      setLotDialogOpen(false);
      setLotLineId("");

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
        description="Approved restock tickets move here automatically. Review a ticket and record only the delivery exceptions."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Receiving needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <QueueStatButton active={view === "ready"} onClick={() => changeView("ready")}>
          <StatCard
            detail={`${queue.readyTotal.toLocaleString()} restock ticket${queue.readyTotal === 1 ? "" : "s"} waiting`}
            icon={Truck}
            title="Awaiting delivery"
            tone="info"
            value={queue.readyTotal.toLocaleString()}
          />
        </QueueStatButton>
        <QueueStatButton active={view === "partial"} onClick={() => changeView("partial")}>
          <StatCard
            detail={
              queue.partialTotal > 0
                ? `${queue.partialTotal.toLocaleString()} ticket${queue.partialTotal === 1 ? "" : "s"} need follow-up`
                : "No incomplete deliveries"
            }
            icon={Clock3}
            title="Partial deliveries"
            tone="warning"
            value={queue.partialTotal.toLocaleString()}
          />
        </QueueStatButton>
        <QueueStatButton active={view === "history"} onClick={() => changeView("history")}>
          <StatCard
            detail="Completed delivery tickets"
            icon={CheckCircle2}
            title="Received history"
            tone="success"
            value={queue.historyTotal.toLocaleString()}
          />
        </QueueStatButton>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              {view === "ready"
                ? "Incoming deliveries"
                : view === "partial"
                  ? "Partial deliveries"
                  : "Received deliveries"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {view === "ready"
                ? "Open a restock ticket to preview its products before receiving."
                : view === "partial"
                  ? "Continue the same ticket when the remaining products arrive."
                  : "Completed tickets remain available for delivery and return history."}
            </p>
          </div>
          <Badge variant={view === "partial" ? "warning" : view === "history" ? "success" : "info"}>
            {visibleTotal.toLocaleString()} ticket{visibleTotal === 1 ? "" : "s"}
          </Badge>
        </div>

        {loading && visibleOrders.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-500">
            Loading restock tickets…
          </div>
        ) : null}

        {!loading && visibleOrders.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Inbox aria-hidden="true" className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {view === "ready"
                ? "No deliveries are waiting."
                : view === "partial"
                  ? "No partial deliveries."
                  : "No completed deliveries yet."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {view === "ready"
                ? "Confirmed restocks from Reports will appear here automatically."
                : "This list updates automatically as physical deliveries are recorded."}
            </p>
          </div>
        ) : null}

        {visibleOrders.length > 0 ? (
          <Accordion.Root
            onValueChange={(values) =>
              setExpandedTicketId((values[0] as string | undefined) ?? null)
            }
            value={expandedTicketId ? [expandedTicketId] : []}
          >
            {visibleOrders.map((order) => {
              const totals = orderTotals(order);
              const hasReturn = hasRestockReturnItems(order);
              return (
                <Accordion.Item
                  className="border-b border-slate-100 last:border-b-0"
                  key={order.id}
                  value={order.id}
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-950">
                            {order.orderNumber}
                          </span>
                          <Badge variant={statusVariant(order.status)}>
                            {statusLabel(order.status)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {totals.products.toLocaleString()} product
                          {totals.products === 1 ? "" : "s"} · {totals.units.toLocaleString()} units
                          ·{" "}
                          {order.approvedAt
                            ? `Approved ${dateFormatter.format(new Date(order.approvedAt))}`
                            : "Approved"}
                          {totals.remaining > 0
                            ? ` · ${totals.remaining.toLocaleString()} remaining`
                            : ""}
                        </p>
                      </div>
                      <ChevronDown
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-data-[panel-open]:rotate-180"
                      />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Panel className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                    <div className="rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Ticket products</p>
                          <p className="text-xs text-slate-500">
                            Approved quantities for this restock.
                          </p>
                        </div>
                        <Badge>{totals.products.toLocaleString()} items</Badge>
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {selectedLines(order).map((line) => (
                          <div
                            className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-2.5 last:border-b-0"
                            key={line.id}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {line.product.name}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">{line.product.sku}</p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-slate-800">
                              {remainingQuantity(line).toLocaleString()} remaining
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
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
                      </div>
                      <Button onClick={() => openTicket(order)} size="sm" type="button">
                        {order.status === "RECEIVED"
                          ? "View delivery"
                          : order.status === "PARTIALLY_RECEIVED"
                            ? "Continue receiving"
                            : "Receive delivery"}
                      </Button>
                    </div>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion.Root>
        ) : null}

        {visibleTotal > visibleOrders.length ? (
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Showing the latest {visibleOrders.length.toLocaleString()} of{" "}
            {visibleTotal.toLocaleString()} tickets.
          </p>
        ) : null}
      </section>

      <Dialog
        onOpenChange={(open) => {
          if (!open) closeTicket();
        }}
        open={Boolean(selectedOrder)}
      >
        <DialogContent className="max-h-[85vh] max-w-[960px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0">
          {selectedOrder && selectedTotals ? (
            <>
              <DialogHeader className="relative border-b border-slate-200 px-6 py-5 pr-16">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>{selectedOrder.orderNumber}</DialogTitle>
                  <Badge variant={statusVariant(selectedOrder.status)}>
                    {statusLabel(selectedOrder.status)}
                  </Badge>
                </div>
                <DialogDescription>
                  {selectedTotals.products.toLocaleString()} products ·{" "}
                  {selectedTotals.units.toLocaleString()} expected ·{" "}
                  {selectedTotals.accepted.toLocaleString()} accepted
                </DialogDescription>
                <Button
                  aria-label="Close delivery"
                  className="absolute right-5 top-5 h-8 w-8"
                  disabled={saving}
                  onClick={closeTicket}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </DialogHeader>

              <div className="min-h-0 overflow-y-auto px-6 py-5">
                <div className="space-y-5">
                  {receiptError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Delivery needs attention</AlertTitle>
                      <AlertDescription>{receiptError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {selectedOrder.status === "RECEIVED" ? (
                    <>
                      <TicketItemsPreview order={selectedOrder} />
                      <CompletedDeliveryPanel
                        onReturnReport={() => setReturnReportOrder(selectedOrder)}
                        order={selectedOrder}
                      />
                    </>
                  ) : receiptMode === null ? (
                    <>
                      <TicketItemsPreview order={selectedOrder} />
                      <ArrivalOptions onSelect={startReceipt} />
                    </>
                  ) : receiptMode === "complete" ? (
                    <>
                      <TicketItemsPreview order={selectedOrder} />
                      <CompleteDeliveryPanel order={selectedOrder} />
                    </>
                  ) : (
                    <ReceiptEditor
                      damageReason={damageReason}
                      exceptionLineIds={exceptionLineIds}
                      mode={receiptMode}
                      onDamageReasonChange={setDamageReason}
                      onExceptionChange={setExceptionLineIds}
                      onMarkAllDamaged={markEntireDeliveryDamaged}
                      onOpenLotDetails={openLotDetails}
                      onUpdateRow={updateRow}
                      order={selectedOrder}
                      rows={receiptRows}
                    />
                  )}
                </div>
              </div>

              {selectedOrder.status !== "RECEIVED" && receiptMode ? (
                <DialogFooter className="bg-white">
                  <Button
                    disabled={saving}
                    onClick={() => {
                      setReceiptMode(null);
                      setReceiptRows(initialReceiptRows(selectedOrder));
                      setExceptionLineIds([]);
                      setDamageReason("");
                      setReceiptError(null);
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
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    )}
                    {saving
                      ? "Recording…"
                      : receiptMode === "complete"
                        ? "Confirm complete delivery"
                        : "Confirm delivery"}
                  </Button>
                </DialogFooter>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <LotExpiryDialog
        lineId={lotLineId}
        lines={acceptedLotLines}
        onLineChange={setLotLineId}
        onOpenChange={setLotDialogOpen}
        onUpdateRow={updateRow}
        open={lotDialogOpen}
        rows={receiptRows}
      />

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

function QueueStatButton({
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
      aria-pressed={active}
      className={`rounded-xl text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
        active ? "ring-2 ring-indigo-500 ring-offset-2" : "hover:shadow-md"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function TicketItemsPreview({ order }: { order: RestockOrder }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Ticket items</h3>
          <p className="text-xs text-slate-500">Expected quantities from the approved restock.</p>
        </div>
        <Badge>{selectedLines(order).length.toLocaleString()} items</Badge>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
          <span>Product</span>
          <span className="text-right">Expected</span>
          <span className="text-right">Remaining</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {selectedLines(order).map((line) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_88px_88px] items-center border-t border-slate-100 px-4 py-2.5"
              key={line.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-950">{line.product.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{line.product.sku}</p>
              </div>
              <span className="text-right text-sm font-medium text-slate-700">
                {line.requestedQuantity.toLocaleString()}
              </span>
              <span className="text-right text-sm font-semibold text-slate-950">
                {remainingQuantity(line).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArrivalOptions({ onSelect }: { onSelect: (mode: ReceiptMode) => void }) {
  const choices: Array<{
    description: string;
    icon: typeof CheckCircle2;
    mode: ReceiptMode;
    title: string;
  }> = [
    {
      description: "Everything expected arrived and nothing is damaged.",
      icon: CheckCircle2,
      mode: "complete",
      title: "Complete — No issues"
    },
    {
      description: "Everything arrived, but one or more units are damaged.",
      icon: TriangleAlert,
      mode: "issues",
      title: "Complete — With issues"
    },
    {
      description: "Some products or quantities are still missing.",
      icon: Clock3,
      mode: "partial",
      title: "Partial delivery"
    }
  ];

  return (
    <section>
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-slate-950">How did this delivery arrive?</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Choose one. Extra fields appear only for exceptions.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {choices.map((choice, index) => {
          const Icon = choice.icon;
          return (
            <button
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                index > 0 ? "border-t border-slate-100" : ""
              }`}
              key={choice.mode}
              onClick={() => onSelect(choice.mode)}
              type="button"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <Icon aria-hidden="true" className="h-4 w-4 text-slate-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-950">{choice.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{choice.description}</p>
              </div>
              <ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 text-slate-400" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CompleteDeliveryPanel({ order }: { order: RestockOrder }) {
  const totalRemaining = selectedLines(order).reduce(
    (sum, line) => sum + remainingQuantity(line),
    0
  );
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-emerald-950">Complete delivery — no issues</p>
          <p className="mt-0.5 text-xs leading-5 text-emerald-800">
            {totalRemaining.toLocaleString()} remaining units will be accepted. No quantity editing
            is needed.
          </p>
        </div>
      </div>
    </section>
  );
}

function CompletedDeliveryPanel({
  onReturnReport,
  order
}: {
  onReturnReport: () => void;
  order: RestockOrder;
}) {
  const hasReturn = hasRestockReturnItems(order);
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-950">Delivery completed</p>
          <p className="mt-0.5 text-xs leading-5 text-emerald-800">
            Accepted units are already reflected in Inventory.
          </p>
        </div>
        {hasReturn ? (
          <Button onClick={onReturnReport} size="sm" type="button" variant="secondary">
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Return report
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function ReceiptEditor({
  damageReason,
  exceptionLineIds,
  mode,
  onDamageReasonChange,
  onExceptionChange,
  onMarkAllDamaged,
  onOpenLotDetails,
  onUpdateRow,
  order,
  rows
}: {
  damageReason: string;
  exceptionLineIds: string[];
  mode: Exclude<ReceiptMode, "complete">;
  onDamageReasonChange: (value: string) => void;
  onExceptionChange: (value: string[]) => void;
  onMarkAllDamaged: () => void;
  onOpenLotDetails: () => void;
  onUpdateRow: (lineId: string, update: (row: ReceiptRowState) => ReceiptRowState) => void;
  order: RestockOrder;
  rows: Record<string, ReceiptRowState>;
}) {
  const remainingLines = selectedLines(order).filter((line) => remainingQuantity(line) > 0);
  const exceptionLines = remainingLines.filter((line) => exceptionLineIds.includes(line.id));
  const hasDamage = exceptionLines.some((line) => {
    const row = rows[line.id];
    return row ? asWholeNumber(row.damagedQuantity) > 0 : false;
  });

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              {mode === "issues"
                ? "Which products have an issue?"
                : "Which products did not fully arrive?"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Select only the exceptions. All unselected products are treated as fully delivered.
            </p>
          </div>
          {mode === "issues" ? (
            <Button onClick={onMarkAllDamaged} size="sm" type="button" variant="ghost">
              Mark entire delivery damaged
            </Button>
          ) : null}
        </div>

        <CheckboxGroup
          aria-label={mode === "issues" ? "Products with issues" : "Products not fully delivered"}
          className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
          onValueChange={onExceptionChange}
          value={exceptionLineIds}
        >
          {remainingLines.map((line) => {
            const checked = exceptionLineIds.includes(line.id);
            return (
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
                  checked
                    ? "border-indigo-300 bg-indigo-50/70"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
                key={line.id}
              >
                <Checkbox.Root
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-white data-[checked]:border-indigo-600 data-[checked]:bg-indigo-600"
                  value={line.id}
                >
                  <Checkbox.Indicator>
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {line.product.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {line.product.sku} · {remainingQuantity(line).toLocaleString()} expected
                  </span>
                </span>
              </label>
            );
          })}
        </CheckboxGroup>
      </section>

      {exceptionLines.length > 0 ? (
        <section>
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-slate-950">Exception details</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Accepted quantity is calculated automatically. Edit only the selected exceptions.
            </p>
          </div>
          <div className="space-y-2">
            {exceptionLines.map((line) => {
              const row = rows[line.id];
              if (!row) return null;
              const remaining = remainingQuantity(line);
              const accepted = acceptedQuantity(row);
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-4" key={line.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{line.product.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {line.product.sku} · {remaining.toLocaleString()} expected
                      </p>
                    </div>
                    <div
                      className={`grid gap-3 ${mode === "partial" ? "grid-cols-3" : "grid-cols-2"}`}
                    >
                      {mode === "partial" ? (
                        <QuantityField
                          label="Delivered"
                          onChange={(value) =>
                            onUpdateRow(line.id, (current) => ({
                              ...current,
                              deliveredQuantity: value
                            }))
                          }
                          value={row.deliveredQuantity}
                        />
                      ) : null}
                      <QuantityField
                        label="Damaged"
                        onChange={(value) =>
                          onUpdateRow(line.id, (current) => ({
                            ...current,
                            damagedQuantity: value
                          }))
                        }
                        value={row.damagedQuantity}
                      />
                      <div className="min-w-20">
                        <p className="text-xs font-medium text-slate-500">Accepted</p>
                        <p className="mt-1.5 text-right text-sm font-semibold text-emerald-700">
                          {accepted.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  {accepted > remaining ? (
                    <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-800">
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
                      Confirm over-delivery
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {hasDamage ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
          <Label htmlFor="damage-return-reason">Damage / return reason *</Label>
          <Input
            className="mt-1"
            id="damage-return-reason"
            maxLength={240}
            onChange={(event) => onDamageReasonChange(event.target.value)}
            placeholder="e.g. Dented cans during transport"
            value={damageReason}
          />
          <p className="mt-1.5 text-xs text-amber-800">
            This reason will appear on the supplier/manufacturer Return Report for every damaged
            unit in this receiving event.
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">Supplier lot / expiry details</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Optional unless the supplier printed a specific lot or expiry.
          </p>
        </div>
        <Button onClick={onOpenLotDetails} size="sm" type="button" variant="secondary">
          Add details
        </Button>
      </section>
    </div>
  );
}

function QuantityField({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="min-w-20">
      <Label className="text-xs">{label}</Label>
      <Input
        className="mt-1 h-8 w-20 text-right"
        inputMode="numeric"
        min="0"
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
    </div>
  );
}

function LotExpiryDialog({
  lineId,
  lines,
  onLineChange,
  onOpenChange,
  onUpdateRow,
  open,
  rows
}: {
  lineId: string;
  lines: RestockOrderLine[];
  onLineChange: (lineId: string) => void;
  onOpenChange: (open: boolean) => void;
  onUpdateRow: (lineId: string, update: (row: ReceiptRowState) => ReceiptRowState) => void;
  open: boolean;
  rows: Record<string, ReceiptRowState>;
}) {
  const activeLine = lines.find((line) => line.id === lineId) ?? lines[0];
  const row = activeLine ? rows[activeLine.id] : undefined;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-[560px] gap-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Supplier lot / expiry details</DialogTitle>
          <DialogDescription>
            Add these only when the supplier printed specific traceability details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          {activeLine && row ? (
            <>
              <div>
                <Label htmlFor="lot-product">Product</Label>
                <Select
                  className="mt-1"
                  id="lot-product"
                  onChange={(event) => onLineChange(event.target.value)}
                  value={activeLine.id}
                >
                  {lines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.product.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="supplier-lot">Supplier lot / batch</Label>
                <Input
                  className="mt-1"
                  id="supplier-lot"
                  maxLength={80}
                  onChange={(event) =>
                    onUpdateRow(activeLine.id, (current) => ({
                      ...current,
                      batchCode: event.target.value
                    }))
                  }
                  value={row.batchCode}
                />
              </div>
              <div>
                <Label htmlFor="supplier-expiry">Expiration date</Label>
                <Input
                  className="mt-1"
                  disabled={row.noExpiration}
                  id="supplier-expiry"
                  onChange={(event) =>
                    onUpdateRow(activeLine.id, (current) => ({
                      ...current,
                      expiresAt: event.target.value
                    }))
                  }
                  type="date"
                  value={row.expiresAt}
                />
              </div>
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <Checkbox.Root
                  checked={row.noExpiration}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-white data-[checked]:border-indigo-600 data-[checked]:bg-indigo-600"
                  onCheckedChange={(checked) =>
                    onUpdateRow(activeLine.id, (current) => ({
                      ...current,
                      expiresAt: checked ? "" : current.expiresAt,
                      noExpiration: checked
                    }))
                  }
                >
                  <Checkbox.Indicator>
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                No expiry printed / not applicable
              </label>
            </>
          ) : (
            <p className="text-sm text-slate-500">No accepted products need lot details.</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
