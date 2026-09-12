import {
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Send,
  ShieldAlert,
  Truck
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode
} from "react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  cancelRestockOrder,
  listRestockOrders,
  markRestockOrderAwaitingDelivery,
  receiveRestockOrder,
  type RestockOrder,
  type RestockOrderLine,
  type RestockOrderStatus,
  type RestockReceiptLineInput
} from "@/services/restockApi";

const ACTIVE_STATUSES: RestockOrderStatus[] = [
  "DRAFT",
  "APPROVED",
  "AWAITING_DELIVERY",
  "PARTIALLY_RECEIVED"
];

type ReceiptRowState = {
  deliveredQuantity: string;
  damagedQuantity: string;
  acceptedQuantity: string;
  batchCode: string;
  expiresAt: string;
  noExpiration: boolean;
  scannedBarcode: string;
  confirmNewBarcode: boolean;
  confirmOverDelivery: boolean;
};

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

function selectedLines(order: RestockOrder) {
  return order.lines.filter((line) => line.isSelected && line.requestedQuantity > 0);
}

function remainingQuantity(line: RestockOrderLine) {
  return Math.max(0, line.requestedQuantity - line.receivedQuantity);
}

function asWholeNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function buildReceiptRows(order: RestockOrder) {
  return Object.fromEntries(
    selectedLines(order)
      .filter((line) => remainingQuantity(line) > 0)
      .map((line) => {
        const remaining = remainingQuantity(line);
        return [
          line.id,
          {
            acceptedQuantity: String(remaining),
            batchCode: "",
            confirmNewBarcode: false,
            confirmOverDelivery: false,
            damagedQuantity: "0",
            deliveredQuantity: String(remaining),
            expiresAt: "",
            noExpiration: true,
            scannedBarcode: ""
          } satisfies ReceiptRowState
        ];
      })
  ) as Record<string, ReceiptRowState>;
}

export function RestockReceivingPanel({
  refreshVersion = 0,
  onOrdersChanged
}: {
  refreshVersion?: number;
  onOrdersChanged: () => void;
}) {
  const [orders, setOrders] = useState<RestockOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<RestockOrder | null>(null);
  const [receiptRows, setReceiptRows] = useState<Record<string, ReceiptRowState>>({});
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [cancelOrder, setCancelOrder] = useState<RestockOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listRestockOrders({
        page: 1,
        pageSize: 100,
        statuses: ACTIVE_STATUSES
      });
      setOrders(result.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Active restock orders could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshVersion;
    void loadOrders();
  }, [loadOrders, refreshVersion]);

  const activeUnits = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          sum +
          selectedLines(order).reduce((lineSum, line) => lineSum + remainingQuantity(line), 0),
        0
      ),
    [orders]
  );

  async function markAwaiting(order: RestockOrder) {
    if (busyOrderId) return;
    setBusyOrderId(order.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await markRestockOrderAwaitingDelivery(order.id, order.version);
      setNotice(`${updated.orderNumber} is now awaiting delivery.`);
      onOrdersChanged();
      await loadOrders();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The order status could not be updated."
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  function openReceipt(order: RestockOrder) {
    setReceiptOrder(order);
    setReceiptRows(buildReceiptRows(order));
    setReceiptError(null);
  }

  function updateReceiptRow(
    lineId: string,
    update: (current: ReceiptRowState) => ReceiptRowState
  ) {
    setReceiptRows((current) => {
      const row = current[lineId];
      if (!row) return current;
      return { ...current, [lineId]: update(row) };
    });
    setReceiptError(null);
  }

  function updateReceiptQuantity(
    lineId: string,
    field: "deliveredQuantity" | "damagedQuantity" | "acceptedQuantity",
    value: string
  ) {
    updateReceiptRow(lineId, (current) => {
      const next = { ...current, [field]: value };
      if (field === "deliveredQuantity" || field === "damagedQuantity") {
        const delivered = asWholeNumber(next.deliveredQuantity);
        const damaged = asWholeNumber(next.damagedQuantity);
        next.acceptedQuantity = String(Math.max(0, delivered - damaged));
      }
      return next;
    });
  }

  function buildReceiptPayload(order: RestockOrder) {
    const payload: RestockReceiptLineInput[] = [];

    for (const line of selectedLines(order)) {
      const row = receiptRows[line.id];
      if (!row) continue;

      const deliveredQuantity = asWholeNumber(row.deliveredQuantity);
      const damagedQuantity = asWholeNumber(row.damagedQuantity);
      const acceptedQuantity = asWholeNumber(row.acceptedQuantity);
      if (deliveredQuantity === 0) continue;

      if (damagedQuantity > deliveredQuantity) {
        throw new Error(`${line.product.name}: damaged quantity exceeds delivered quantity.`);
      }
      if (acceptedQuantity > deliveredQuantity - damagedQuantity) {
        throw new Error(`${line.product.name}: accepted quantity exceeds usable delivered units.`);
      }
      if (acceptedQuantity > 0 && !row.batchCode.trim()) {
        throw new Error(`${line.product.name}: enter the supplier or receiving batch code.`);
      }
      if (acceptedQuantity > 0 && !row.noExpiration && !row.expiresAt) {
        throw new Error(`${line.product.name}: choose an expiry date or mark No expiration.`);
      }
      if (acceptedQuantity > remainingQuantity(line) && !row.confirmOverDelivery) {
        throw new Error(
          `${line.product.name}: confirm the over-delivery before accepting extra units.`
        );
      }

      payload.push({
        acceptedQuantity,
        batchCode: row.batchCode.trim() || null,
        confirmNewBarcode: row.confirmNewBarcode,
        confirmOverDelivery: row.confirmOverDelivery,
        damagedQuantity,
        deliveredQuantity,
        expiresAt: row.noExpiration || !row.expiresAt ? null : row.expiresAt,
        lineId: line.id,
        noExpiration: row.noExpiration,
        scannedBarcode: row.scannedBarcode.trim() || null
      });
    }

    if (payload.length === 0) {
      throw new Error("Record at least one delivered unit before completing the receipt.");
    }

    return payload;
  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receiptOrder || receiptSaving) return;

    setReceiptSaving(true);
    setReceiptError(null);
    try {
      const lines = buildReceiptPayload(receiptOrder);
      const updated = await receiveRestockOrder(receiptOrder.id, {
        expectedVersion: receiptOrder.version,
        lines
      });
      setNotice(
        `${updated.orderNumber} receipt saved. Only accepted units were added to physical inventory.`
      );
      setReceiptOrder(null);
      setReceiptRows({});
      onOrdersChanged();
      await loadOrders();
    } catch (requestError) {
      setReceiptError(
        requestError instanceof Error ? requestError.message : "The delivery could not be received."
      );
    } finally {
      setReceiptSaving(false);
    }
  }

  async function submitCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancelOrder || cancelSaving) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) return;

    setCancelSaving(true);
    setError(null);
    try {
      const updated = await cancelRestockOrder(cancelOrder.id, {
        expectedVersion: cancelOrder.version,
        reason
      });
      setNotice(`${updated.orderNumber} was cancelled with an audit reason.`);
      setCancelOrder(null);
      setCancelReason("");
      onOrdersChanged();
      await loadOrders();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "The order could not be cancelled."
      );
    } finally {
      setCancelSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Receiving & lifecycle</CardTitle>
                <Badge>{orders.length.toLocaleString()} active</Badge>
                <Badge variant="warning">{activeUnits.toLocaleString()} units remaining</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Move confirmed orders to awaiting delivery, record actual arrivals, and keep
                cancellations auditable. Inventory changes only from accepted receipt quantities.
              </p>
            </div>
            <Button
              disabled={loading}
              onClick={() => void loadOrders()}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw
                aria-hidden="true"
                className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Receiving needs attention</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {notice ? (
            <Alert>
              <AlertTitle>Restock updated</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}

          {loading && orders.length === 0 ? (
            <div className="rounded-lg border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              Loading active restock orders…
            </div>
          ) : null}

          {!loading && orders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-9 text-center">
              <PackageCheck aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-950">No active deliveries.</p>
              <p className="mt-1 text-sm text-slate-500">
                Confirm a restock plan first. Received and cancelled orders remain in Orders history.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            {orders.map((order) => {
              const lines = selectedLines(order);
              const ordered = lines.reduce((sum, line) => sum + line.requestedQuantity, 0);
              const received = lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
              const remaining = lines.reduce((sum, line) => sum + remainingQuantity(line), 0);
              const busy = busyOrderId === order.id;
              const canReceive =
                order.status === "AWAITING_DELIVERY" || order.status === "PARTIALLY_RECEIVED";
              const canCancel =
                order.status === "DRAFT" ||
                order.status === "APPROVED" ||
                (order.status === "AWAITING_DELIVERY" && received === 0);

              return (
                <article
                  className="rounded-lg border border-slate-200 bg-white px-4 py-4"
                  key={order.id}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {order.orderNumber}
                        </p>
                        <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {lines.length.toLocaleString()} product{lines.length === 1 ? "" : "s"} ·{" "}
                        {received.toLocaleString()} accepted of {ordered.toLocaleString()} ordered ·{" "}
                        {remaining.toLocaleString()} remaining
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {order.status === "APPROVED" ? (
                        <Button
                          disabled={busy}
                          onClick={() => void markAwaiting(order)}
                          size="sm"
                          type="button"
                        >
                          {busy ? (
                            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send aria-hidden="true" className="h-4 w-4" />
                          )}
                          Mark awaiting delivery
                        </Button>
                      ) : null}
                      {canReceive ? (
                        <Button onClick={() => openReceipt(order)} size="sm" type="button">
                          <Truck aria-hidden="true" className="h-4 w-4" />
                          Receive goods
                        </Button>
                      ) : null}
                      {canCancel ? (
                        <Button
                          onClick={() => {
                            setCancelOrder(order);
                            setCancelReason("");
                          }}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Cancel order
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {order.status === "DRAFT" ? (
                    <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      Drafts must be confirmed from Plan restock before supplier/delivery actions.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(receiptOrder)}
        onOpenChange={(open) => {
          if (!open && !receiptSaving) {
            setReceiptOrder(null);
            setReceiptRows({});
            setReceiptError(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-24px)] max-w-[1040px] flex-col overflow-hidden p-0">
          {receiptOrder ? (
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitReceipt}>
              <DialogHeader className="border-b border-slate-200 px-6 py-5">
                <DialogTitle>Receive {receiptOrder.orderNumber}</DialogTitle>
                <DialogDescription>
                  Enter what physically arrived. Delivered and damaged quantities are audit data;
                  only Accepted is sent through the transactional stock-in engine.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {receiptError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Receipt not saved</AlertTitle>
                    <AlertDescription>{receiptError}</AlertDescription>
                  </Alert>
                ) : null}

                <Alert>
                  <AlertTitle>Atomic receiving</AlertTitle>
                  <AlertDescription>
                    Barcode enrollment, batch stock-in, movement history, order received quantity,
                    and order status commit together. A conflict rolls the whole receipt back.
                  </AlertDescription>
                </Alert>

                {selectedLines(receiptOrder)
                  .filter((line) => remainingQuantity(line) > 0)
                  .map((line) => {
                    const row = receiptRows[line.id];
                    if (!row) return null;
                    const remaining = remainingQuantity(line);
                    const accepted = asWholeNumber(row.acceptedQuantity);
                    const overDelivery = accepted > remaining;

                    return (
                      <section
                        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
                        key={line.id}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {line.product.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              SKU {line.product.sku} · Ordered {line.requestedQuantity.toLocaleString()} ·
                              Already accepted {line.receivedQuantity.toLocaleString()} · Remaining{" "}
                              {remaining.toLocaleString()}
                            </p>
                          </div>
                          {line.product.status === "DISCONTINUED" ? (
                            <Badge variant="danger">Discontinued</Badge>
                          ) : null}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="Delivered">
                            <Input
                              inputMode="numeric"
                              min="0"
                              type="number"
                              value={row.deliveredQuantity}
                              onChange={(event) =>
                                updateReceiptQuantity(line.id, "deliveredQuantity", event.target.value)
                              }
                            />
                          </Field>
                          <Field label="Damaged on arrival">
                            <Input
                              inputMode="numeric"
                              min="0"
                              type="number"
                              value={row.damagedQuantity}
                              onChange={(event) =>
                                updateReceiptQuantity(line.id, "damagedQuantity", event.target.value)
                              }
                            />
                          </Field>
                          <Field label="Accepted into inventory">
                            <Input
                              inputMode="numeric"
                              min="0"
                              type="number"
                              value={row.acceptedQuantity}
                              onChange={(event) =>
                                updateReceiptQuantity(line.id, "acceptedQuantity", event.target.value)
                              }
                            />
                          </Field>
                        </div>

                        {accepted > 0 ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <Field label="Batch code">
                              <Input
                                placeholder="Supplier / carton batch"
                                value={row.batchCode}
                                onChange={(event) =>
                                  updateReceiptRow(line.id, (current) => ({
                                    ...current,
                                    batchCode: event.target.value
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Expiration date">
                              <Input
                                disabled={row.noExpiration}
                                type="date"
                                value={row.expiresAt}
                                onChange={(event) =>
                                  updateReceiptRow(line.id, (current) => ({
                                    ...current,
                                    expiresAt: event.target.value
                                  }))
                                }
                              />
                              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                                <input
                                  checked={row.noExpiration}
                                  onChange={(event) =>
                                    updateReceiptRow(line.id, (current) => ({
                                      ...current,
                                      expiresAt: event.target.checked ? "" : current.expiresAt,
                                      noExpiration: event.target.checked
                                    }))
                                  }
                                  type="checkbox"
                                />
                                No expiration / not applicable
                              </label>
                            </Field>
                            <Field label="Scanned barcode (optional)">
                              <Input
                                value={row.scannedBarcode}
                                onChange={(event) =>
                                  updateReceiptRow(line.id, (current) => ({
                                    ...current,
                                    scannedBarcode: event.target.value
                                  }))
                                }
                              />
                              {row.scannedBarcode.trim() ? (
                                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                                  <input
                                    checked={row.confirmNewBarcode}
                                    onChange={(event) =>
                                      updateReceiptRow(line.id, (current) => ({
                                        ...current,
                                        confirmNewBarcode: event.target.checked
                                      }))
                                    }
                                    type="checkbox"
                                  />
                                  Confirm enrollment if this barcode is new to the product
                                </label>
                              ) : null}
                            </Field>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
                              Accepted quantity is the only quantity that increases inventory.
                              Damaged and other rejected units remain receipt discrepancies.
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                            No units from this line will be added to inventory. The delivery discrepancy
                            is still recorded on the restock line.
                          </div>
                        )}

                        {overDelivery ? (
                          <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
                            <input
                              checked={row.confirmOverDelivery}
                              className="mt-0.5"
                              onChange={(event) =>
                                updateReceiptRow(line.id, (current) => ({
                                  ...current,
                                  confirmOverDelivery: event.target.checked
                                }))
                              }
                              type="checkbox"
                            />
                            <span>
                              Confirm over-delivery: accept {accepted.toLocaleString()} although only{" "}
                              {remaining.toLocaleString()} units remain on the order.
                            </span>
                          </label>
                        ) : null}
                      </section>
                    );
                  })}
              </div>

              <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
                <Button
                  disabled={receiptSaving}
                  onClick={() => {
                    setReceiptOrder(null);
                    setReceiptRows({});
                    setReceiptError(null);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button disabled={receiptSaving} type="submit">
                  {receiptSaving ? (
                    <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <PackageCheck aria-hidden="true" className="h-4 w-4" />
                  )}
                  {receiptSaving ? "Saving receipt..." : "Complete receipt"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(cancelOrder)}
        onOpenChange={(open) => {
          if (!open && !cancelSaving) {
            setCancelOrder(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent className="max-w-[520px]">
          {cancelOrder ? (
            <form onSubmit={submitCancellation}>
              <DialogHeader>
                <DialogTitle>Cancel {cancelOrder.orderNumber}</DialogTitle>
                <DialogDescription>
                  Cancellation is a controlled procurement action. A reason is required and recorded
                  with the actor and timestamp.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 px-6 pb-2">
                <Alert variant="destructive">
                  <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                  <AlertTitle>Confirm cancellation</AlertTitle>
                  <AlertDescription>
                    This does not remove order history. Orders with received stock cannot be cancelled.
                  </AlertDescription>
                </Alert>
                <Field label="Cancellation reason">
                  <Textarea
                    autoFocus
                    maxLength={500}
                    placeholder="Why is this restock no longer proceeding?"
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                  />
                </Field>
              </div>

              <DialogFooter>
                <Button
                  disabled={cancelSaving}
                  onClick={() => {
                    setCancelOrder(null);
                    setCancelReason("");
                  }}
                  type="button"
                  variant="secondary"
                >
                  Keep order
                </Button>
                <Button
                  disabled={cancelSaving || cancelReason.trim().length < 3}
                  type="submit"
                  variant="destructive"
                >
                  {cancelSaving ? (
                    <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : null}
                  Cancel restock
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
