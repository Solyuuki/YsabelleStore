import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Inbox,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ReturnReportDialog } from "@/components/receiving/ReturnReportDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  function closeTicket() {
    if (saving) return;
    setSelectedOrder(null);
    setReceiptMode(null);
    setReceiptRows({});
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
        description="Approved restock tickets move here automatically. Open a ticket and record only what differs from the expected delivery."
        actions={
          <Button
            aria-label="Refresh receiving"
            className="h-9 w-9"
            disabled={loading}
            onClick={() => void loadQueue()}
            size="icon"
            title="Refresh receiving"
            type="button"
            variant="ghost"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Receiving needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">
              {view === "ready"
                ? "Restock tickets ready for delivery"
                : view === "partial"
                  ? "Partial deliveries"
                  : "Received history"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {view === "ready"
                ? "Confirmed restocks appear here automatically."
                : view === "partial"
                  ? "Reopen the same ticket when the remaining items arrive."
                  : "Completed tickets stay available for delivery and return history."}
            </p>
          </div>

          <div
            aria-label="Receiving status"
            className="inline-flex w-fit items-center rounded-lg border border-slate-200 bg-slate-50 p-1"
            role="tablist"
          >
            <QueueTab
              active={view === "ready"}
              count={queue.readyTotal}
              label="Awaiting"
              onClick={() => setView("ready")}
            />
            <QueueTab
              active={view === "partial"}
              count={queue.partialTotal}
              label="Partial"
              onClick={() => setView("partial")}
            />
            <QueueTab
              active={view === "history"}
              count={queue.historyTotal}
              label="Received"
              onClick={() => setView("history")}
            />
          </div>
        </div>

        {loading && visibleOrders.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            Loading restock tickets…
          </div>
        ) : null}

        {!loading && visibleOrders.length === 0 ? (
          <div className="px-4 py-14 text-center">
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
                ? "When a restock is confirmed in Reports, the ticket will appear here."
                : "This list updates automatically as physical deliveries are recorded."}
            </p>
          </div>
        ) : null}

        {visibleOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-14 text-right">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOrders.map((order) => {
                  const totals = orderTotals(order);
                  const hasReturn = hasRestockReturnItems(order);

                  return (
                    <TableRow
                      className="cursor-pointer hover:bg-slate-50"
                      key={order.id}
                      onClick={() => openTicket(order)}
                    >
                      <TableCell className="min-w-[260px]">
                        <div className="flex items-center gap-2">
                          <ArrowDownToLine
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-indigo-600"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-950">
                              {order.orderNumber}
                            </p>
                            {hasReturn ? (
                              <button
                                className="mt-0.5 text-xs font-medium text-amber-700 hover:text-amber-800 hover:underline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setReturnReportOrder(order);
                                }}
                                type="button"
                              >
                                Return report available
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[220px] text-slate-600">
                        {totals.products.toLocaleString()} product
                        {totals.products === 1 ? "" : "s"} · {totals.units.toLocaleString()} units
                        {totals.remaining > 0
                          ? ` · ${totals.remaining.toLocaleString()} remaining`
                          : ""}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {order.approvedAt
                          ? dateFormatter.format(new Date(order.approvedAt))
                          : "Approved"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(order.status)}>
                          {statusLabel(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          aria-label={`Open ${order.orderNumber}`}
                          className="h-8 w-8"
                          onClick={(event) => {
                            event.stopPropagation();
                            openTicket(order);
                          }}
                          size="icon"
                          title="Open delivery"
                          type="button"
                          variant="ghost"
                        >
                          <ChevronRight aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {visibleTotal > visibleOrders.length ? (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            Showing the latest {visibleOrders.length.toLocaleString()} of{" "}
            {visibleTotal.toLocaleString()} tickets.
          </p>
        ) : null}
      </section>

      <Sheet
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) closeTicket();
        }}
      >
        <SheetContent className="max-w-[760px] p-0">
          {selectedOrder && selectedTotals ? (
            <>
              <SheetHeader className="relative shrink-0 border-b border-slate-200 px-5 py-4 pr-14">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="text-lg">{selectedOrder.orderNumber}</SheetTitle>
                  <Badge variant={statusVariant(selectedOrder.status)}>
                    {statusLabel(selectedOrder.status)}
                  </Badge>
                </div>
                <SheetDescription>
                  {selectedTotals.products.toLocaleString()} products ·{" "}
                  {selectedTotals.units.toLocaleString()} expected ·{" "}
                  {selectedTotals.accepted.toLocaleString()} accepted
                </SheetDescription>
                <Button
                  aria-label="Close delivery"
                  className="absolute right-4 top-4 h-8 w-8"
                  disabled={saving}
                  onClick={closeTicket}
                  size="icon"
                  title="Close"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  {receiptError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Delivery needs attention</AlertTitle>
                      <AlertDescription>{receiptError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <TicketItemsTable order={selectedOrder} />

                  {selectedOrder.status === "RECEIVED" ? (
                    <CompletedDeliveryPanel
                      onReturnReport={() => setReturnReportOrder(selectedOrder)}
                      order={selectedOrder}
                    />
                  ) : receiptMode === null ? (
                    <ArrivalOptions onSelect={startReceipt} />
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
                </div>
              </div>

              {selectedOrder.status !== "RECEIVED" && receiptMode ? (
                <SheetFooter className="shrink-0 bg-white px-5 py-3">
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
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    )}
                    {saving
                      ? "Recording…"
                      : receiptMode === "complete"
                        ? "Confirm complete delivery"
                        : "Confirm delivery"}
                  </Button>
                </SheetFooter>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>

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

function QueueTab({
  active,
  count,
  label,
  onClick
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
        active
          ? "bg-white text-slate-950 shadow-sm"
          : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
      }`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
      <span
        className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] ${
          active ? "bg-indigo-50 text-indigo-700" : "bg-slate-200/70 text-slate-600"
        }`}
      >
        {count.toLocaleString()}
      </span>
    </button>
  );
}

function TicketItemsTable({ order }: { order: RestockOrder }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Ticket items</h3>
          <p className="text-xs text-slate-500">Expected quantities from the approved restock.</p>
        </div>
        <Badge>{selectedLines(order).length.toLocaleString()} items</Badge>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="w-24 text-right">Expected</TableHead>
              <TableHead className="w-24 text-right">Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedLines(order).map((line) => (
              <TableRow key={line.id}>
                <TableCell className="py-2.5">
                  <p className="font-medium text-slate-950">{line.product.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{line.product.sku}</p>
                </TableCell>
                <TableCell className="py-2.5 text-right font-medium text-slate-700">
                  {line.requestedQuantity.toLocaleString()}
                </TableCell>
                <TableCell className="py-2.5 text-right font-semibold text-slate-950">
                  {remainingQuantity(line).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
          Choose one. Extra fields only appear when there is an exception.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {choices.map((choice, index) => {
          const Icon = choice.icon;
          return (
            <button
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
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
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          );
        })}
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
  const totalRemaining = remainingLines.reduce((sum, line) => sum + remainingQuantity(line), 0);

  if (mode === "complete") {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-950">Complete delivery — no issues</p>
            <p className="mt-0.5 text-xs leading-5 text-emerald-800">
              {totalRemaining.toLocaleString()} remaining units will be accepted. No quantity
              editing is needed.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              {mode === "issues" ? "Record damaged units" : "Record what actually arrived"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Accepted quantity is calculated automatically. Edit only the exceptions.
            </p>
          </div>

          {mode === "issues" ? (
            <Button onClick={onMarkAllDamaged} size="sm" type="button" variant="ghost">
              Mark entire delivery damaged
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="min-w-[220px]">Product</TableHead>
                <TableHead className="w-20 text-right">Expected</TableHead>
                <TableHead className="w-24 text-right">Delivered</TableHead>
                <TableHead className="w-24 text-right">Damaged</TableHead>
                <TableHead className="w-20 text-right">Accepted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remainingLines.map((line) => {
                const row = rows[line.id];
                if (!row) return null;

                const remaining = remainingQuantity(line);
                const accepted = acceptedQuantity(row);

                return (
                  <TableRow key={line.id}>
                    <TableCell className="py-2.5">
                      <p className="font-medium text-slate-950">{line.product.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {line.product.sku} · {remaining.toLocaleString()} remaining
                      </p>
                      {accepted > remaining ? (
                        <label className="mt-2 flex items-start gap-2 text-xs leading-5 text-amber-800">
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
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-medium text-slate-600">
                      {remaining.toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <CompactQuantityInput
                        disabled={mode === "issues"}
                        onChange={(value) =>
                          onUpdateRow(line.id, (current) => ({
                            ...current,
                            deliveredQuantity: value
                          }))
                        }
                        value={row.deliveredQuantity}
                      />
                    </TableCell>
                    <TableCell className="py-2.5">
                      <CompactQuantityInput
                        onChange={(value) =>
                          onUpdateRow(line.id, (current) => ({
                            ...current,
                            damagedQuantity: value
                          }))
                        }
                        value={row.damagedQuantity}
                      />
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-semibold text-emerald-700">
                      {accepted.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200">
        <button
          aria-expanded={showLotDetails}
          className="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
          onClick={onToggleLotDetails}
          type="button"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">Supplier lot / expiry details</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Optional unless the supplier printed a specific lot or expiry.
            </p>
          </div>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
              showLotDetails ? "rotate-180" : ""
            }`}
          />
        </button>

        {showLotDetails ? (
          <div className="space-y-3 border-t border-slate-200 bg-white p-4">
            {remainingLines.map((line) => {
              const row = rows[line.id];
              if (!row || acceptedQuantity(row) === 0) return null;

              return (
                <div
                  className="grid gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0 md:grid-cols-[1fr_220px]"
                  key={line.id}
                >
                  <div>
                    <Label className="text-xs">{line.product.name} — Batch / lot</Label>
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
      </section>
    </div>
  );
}

function CompactQuantityInput({
  disabled = false,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Input
      className="ml-auto h-8 w-20 text-right"
      disabled={disabled}
      inputMode="numeric"
      min="0"
      onChange={(event) => onChange(event.target.value)}
      type="number"
      value={value}
    />
  );
}
