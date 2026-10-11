import {
  Banknote,
  Box,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  MessageSquareText,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  XCircle
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AppPagination } from "@/components/shared/AppPagination";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  confirmCodCollected,
  getDeliveryTicket,
  listDeliveryTickets,
  updateDeliveryStatus
} from "@/services/deliveryApi";
import type {
  DeliveryListMeta,
  DeliveryTicket,
  DeliveryTicketSummary,
  DeliveryTicketView
} from "@/types/delivery";
import type { StorefrontDeliveryStatus, StorefrontPaymentMethod } from "@/types/storefront";

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short"
});
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP"
});

const DELIVERY_PROGRESS_STEPS: Array<{
  status: StorefrontDeliveryStatus;
  label: string;
}> = [
  { status: "ORDER_PLACED", label: "Order placed" },
  { status: "PREPARING", label: "Preparing" },
  { status: "READY_FOR_DELIVERY", label: "Ready" },
  { status: "OUT_FOR_DELIVERY", label: "On the way" },
  { status: "DELIVERED", label: "Delivered" }
];

const EMPTY_SUMMARY: DeliveryListMeta["summary"] = {
  ORDER_PLACED: 0,
  PREPARING: 0,
  READY_FOR_DELIVERY: 0,
  OUT_FOR_DELIVERY: 0,
  DELIVERED: 0,
  DELIVERY_FAILED: 0,
  CANCELLED: 0
};

function statusLabel(status: StorefrontDeliveryStatus) {
  switch (status) {
    case "ORDER_PLACED":
      return "Order placed";
    case "PREPARING":
      return "Preparing";
    case "READY_FOR_DELIVERY":
      return "Ready for delivery";
    case "OUT_FOR_DELIVERY":
      return "On the way";
    case "DELIVERED":
      return "Delivered";
    case "DELIVERY_FAILED":
      return "Delivery failed";
    case "CANCELLED":
      return "Cancelled";
  }
}

function statusTone(
  status: StorefrontDeliveryStatus
): "default" | "info" | "success" | "warning" | "danger" {
  if (status === "DELIVERED") return "success";
  if (status === "OUT_FOR_DELIVERY") return "info";
  if (status === "DELIVERY_FAILED" || status === "CANCELLED") return "danger";
  if (status === "READY_FOR_DELIVERY") return "warning";
  return "default";
}

function paymentLabel(method: StorefrontPaymentMethod) {
  return method === "CASH_ON_DELIVERY" ? "Cash on Delivery" : "PayMongo";
}

function isPaymongoAwaitingPayment(ticket: DeliveryTicketSummary) {
  return (
    ticket.deliveryStatus !== "CANCELLED" &&
    ticket.paymentMethod === "PAYMONGO" &&
    ticket.paymentStatus !== "PAID"
  );
}

function operationalStatusLabel(ticket: DeliveryTicketSummary) {
  if (isPaymongoAwaitingPayment(ticket)) return "Awaiting payment";
  if (
    ticket.paymentMethod === "CASH_ON_DELIVERY" &&
    ticket.paymentStatus === "PAID" &&
    ticket.deliveryStatus === "DELIVERED"
  ) {
    return "Payment received";
  }
  return statusLabel(ticket.deliveryStatus);
}

function operationalStatusTone(
  ticket: DeliveryTicketSummary
): "default" | "info" | "success" | "warning" | "danger" {
  if (isPaymongoAwaitingPayment(ticket)) return "warning";
  if (
    ticket.paymentMethod === "CASH_ON_DELIVERY" &&
    ticket.paymentStatus === "PAID" &&
    ticket.deliveryStatus === "DELIVERED"
  ) {
    return "success";
  }
  return statusTone(ticket.deliveryStatus);
}

function addressText(ticket: DeliveryTicket) {
  if (!ticket.address) return "No delivery address recorded";
  return [
    ticket.address.addressLine1,
    ticket.address.addressLine2,
    ticket.address.barangay,
    ticket.address.cityMunicipality,
    ticket.address.provinceRegion,
    ticket.address.postalCode,
    ticket.address.country
  ]
    .filter(Boolean)
    .join(", ");
}

export function DeliveriesPage() {
  const [tickets, setTickets] = useState<DeliveryTicketSummary[]>([]);
  const [meta, setMeta] = useState<DeliveryListMeta>({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
    summary: EMPTY_SUMMARY,
    counts: { active: 0, history: 0, all: 0 }
  });
  const [page, setPage] = useState(1);
  const [view, setView] = useState<DeliveryTicketView>("active");
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<StorefrontDeliveryStatus | "all">("all");
  const [paymentMethod, setPaymentMethod] = useState<StorefrontPaymentMethod | "all">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<DeliveryTicket | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [courierProvider, setCourierProvider] = useState("");
  const [customCourierProvider, setCustomCourierProvider] = useState("");
  const [courierReference, setCourierReference] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const result = await listDeliveryTickets(
          {
            page,
            pageSize,
            paymentMethod: paymentMethod === "all" ? undefined : paymentMethod,
            search: search || undefined,
            status: status === "all" ? undefined : status,
            view
          },
          signal
        );
        if (signal?.aborted) return;
        setTickets(result.items);
        setMeta(result.meta);
        if (page !== result.meta.page) setPage(result.meta.page);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(
          reason instanceof Error ? reason.message : "Delivery tickets could not be loaded."
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, pageSize, paymentMethod, search, status, view]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!selected) return;

    const provider = selected.courierProvider?.trim() ?? "";
    if (!provider) {
      setCourierProvider("");
      setCustomCourierProvider("");
    } else if (provider === "Grab" || provider === "Lalamove") {
      setCourierProvider(provider);
      setCustomCourierProvider("");
    } else {
      setCourierProvider("Other");
      setCustomCourierProvider(provider === "Other" ? "" : provider);
    }

    setCourierReference(selected.courierReference ?? "");
    setStaffNote(selected.deliveryNotes ?? "");
  }, [selected]);

  const resolvedCourierProvider =
    courierProvider === "Other" ? customCourierProvider.trim() : courierProvider.trim();

  async function openTicket(ticketId: string) {
    if (openingId) return;
    setOpeningId(ticketId);
    setError("");
    try {
      setSelected(await getDeliveryTicket(ticketId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ticket details could not be loaded.");
    } finally {
      setOpeningId(null);
    }
  }

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function runTransition(
    targetStatus:
      | "PREPARING"
      | "READY_FOR_DELIVERY"
      | "OUT_FOR_DELIVERY"
      | "DELIVERY_FAILED"
      | "CANCELLED"
  ) {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const updated = await updateDeliveryStatus(selected.id, {
        targetStatus,
        courierProvider: resolvedCourierProvider || undefined,
        courierReference: courierReference.trim() || undefined,
        note: staffNote.trim() || undefined
      });
      setSelected(updated);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Delivery status could not be updated.");
    } finally {
      setSubmitting(false);
    }
  }

  async function settleCod() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const updated = await confirmCodCollected(selected.id, staffNote);
      setSelected(updated);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "COD payment could not be confirmed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button disabled={loading} onClick={() => void load()} type="button" variant="secondary">
            <RefreshCw
              aria-hidden="true"
              className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            Refresh
          </Button>
        }
        description="Coordinate customer delivery tickets, courier handoff, receipt confirmation, and Cash on Delivery settlement."
        eyebrow="DELIVERY OPERATIONS"
        title="Deliveries"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={PackageCheck} label="Needs action" value={meta.counts.active} />
        <MetricCard icon={Box} label="Ready for delivery" value={meta.summary.READY_FOR_DELIVERY} />
        <MetricCard icon={Truck} label="On the way" value={meta.summary.OUT_FOR_DELIVERY} />
        <MetricCard icon={CheckCircle2} label="Delivered" value={meta.summary.DELIVERED} />
      </div>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle>
            {view === "history" ? "Ticket history" : view === "all" ? "All delivery tickets" : "Deliveries to handle"}
          </CardTitle>
          <CardDescription>
            {view === "history"
              ? "Delivered and cancelled orders remain searchable, including COD awaiting collection."
              : view === "active"
                ? "Orders to prepare, deliver, or collect payment for. Finished orders are in History."
                : "All retained delivery tickets with server-side pagination."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div aria-label="Delivery ticket views" className="flex flex-wrap gap-2" role="group">
            {(["active", "history", "all"] as const).map((nextView) => (
              <Button
                aria-pressed={view === nextView}
                className={view === nextView
                  ? "border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 dark:border-indigo-400 dark:bg-indigo-500 dark:text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"}
                key={nextView}
                onClick={() => {
                  setView(nextView);
                  setPage(1);
                  setStatus("all");
                }}
                type="button"
                variant="secondary"
              >
                {nextView === "active" ? "Needs action" : nextView === "history" ? "History" : "All tickets"}
                <span className="ml-1 rounded-full bg-black/10 px-2 py-0.5 text-xs dark:bg-white/15">
                  {meta.counts[nextView]}
                </span>
              </Button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <form
              className="flex min-w-0 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                applySearch();
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <Input
                  className="pl-9"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search ticket, order, customer, phone..."
                  value={searchInput}
                />
              </div>
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>

            <Select
              aria-label="Delivery status"
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as StorefrontDeliveryStatus | "all");
              }}
              value={status}
            >
              <option value="all">All delivery statuses</option>
              <option value="ORDER_PLACED">Order placed</option>
              <option value="PREPARING">Preparing</option>
              <option value="READY_FOR_DELIVERY">Ready for delivery</option>
              <option value="OUT_FOR_DELIVERY">On the way</option>
              <option value="DELIVERED">Delivered</option>
              <option value="DELIVERY_FAILED">Delivery failed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>

            <Select
              aria-label="Payment method"
              onChange={(event) => {
                setPage(1);
                setPaymentMethod(event.target.value as StorefrontPaymentMethod | "all");
              }}
              value={paymentMethod}
            >
              <option value="all">All payment methods</option>
              <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
              <option value="PAYMONGO">PayMongo</option>
            </Select>
          </div>

          {error ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead>Ticket / Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[120px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && tickets.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-28 text-center text-slate-500" colSpan={7}>
                      Loading delivery tickets...
                    </TableCell>
                  </TableRow>
                ) : tickets.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-28 text-center text-slate-500" colSpan={7}>
                      {view === "history"
                        ? "No completed or cancelled tickets match these filters."
                        : view === "active"
                          ? "No deliveries need action right now. Check History for finished orders."
                          : "No delivery tickets match these filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  tickets.map((ticket) => (
                    <TableRow className="hover:bg-slate-50/70 dark:hover:bg-slate-700/50" key={ticket.id}>
                      <TableCell>
                        <div className="grid gap-0.5">
                          <strong className="text-slate-950">{ticket.deliveryTicketNumber}</strong>
                          <span className="text-xs text-slate-500">{ticket.orderNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-0.5">
                          <strong className="font-medium text-slate-900">
                            {ticket.customerName}
                          </strong>
                          <span className="text-xs text-slate-500">{ticket.customerPhone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-1">
                          <span>{paymentLabel(ticket.paymentMethod)}</span>
                          <span className="text-xs text-slate-500">{ticket.paymentStatus}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={operationalStatusTone(ticket)}>
                          {operationalStatusLabel(ticket)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-300">
                        {dateTimeFormatter.format(new Date(ticket.updatedAt))}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-950 dark:text-slate-100">
                        {currencyFormatter.format(Number(ticket.totalAmount))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          disabled={Boolean(openingId)}
                          onClick={() => void openTicket(ticket.id)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          {openingId === ticket.id ? "Opening..." : "Open ticket"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <AppPagination
            isLoading={loading}
            itemLabel="tickets"
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPage(1);
              setPageSize(next);
            }}
            page={meta.page}
            pageSize={meta.pageSize}
            totalItems={meta.totalItems}
            totalPages={meta.totalPages}
          />
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !submitting) setSelected(null);
        }}
      >
        {selected ? (
          <DialogContent className="max-h-[90vh] max-w-[900px] overflow-y-auto dark:text-slate-100">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={operationalStatusTone(selected)}>
                  {operationalStatusLabel(selected)}
                </Badge>
                <Badge className="dark:border-slate-500 dark:bg-slate-700/60 dark:text-slate-100">
                  {paymentLabel(selected.paymentMethod)}
                </Badge>
              </div>
              <DialogTitle>{selected.deliveryTicketNumber}</DialogTitle>
              <DialogDescription>
                {selected.orderNumber} · updated{" "}
                {dateTimeFormatter.format(new Date(selected.updatedAt))}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 px-6 pb-2">
              <div className="grid gap-3 md:grid-cols-3">
                <TicketFact
                  detail={selected.customerPhone}
                  icon={UserRound}
                  label="Customer"
                  value={selected.customerName}
                />
                <TicketFact
                  detail={
                    selected.paymentMethod === "CASH_ON_DELIVERY"
                      ? selected.paymentStatus === "PAID"
                        ? "Payment received"
                        : "Awaiting cash collection"
                      : selected.paymentStatus === "PAID"
                        ? "Payment confirmed"
                        : "Awaiting PayMongo payment"
                  }
                  icon={Banknote}
                  label="Payment"
                  value={paymentLabel(selected.paymentMethod)}
                />
                <TicketFact
                  detail={selected.itemCount + " item" + (selected.itemCount === 1 ? "" : "s")}
                  icon={Clock3}
                  label="Total"
                  value={currencyFormatter.format(Number(selected.totalAmount))}
                />
              </div>

              <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-600 dark:bg-slate-800/70">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                  <MapPin
                    className="h-4 w-4 text-indigo-600 dark:text-indigo-300"
                    aria-hidden="true"
                  />
                  Delivery address
                </div>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-200">
                  {addressText(selected)}
                </p>
              </section>

              {selected.notes ? (
                <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/40 dark:bg-amber-950/30">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <MessageSquareText
                      className="h-4 w-4 text-amber-600 dark:text-amber-300"
                      aria-hidden="true"
                    />
                    Customer delivery note
                  </div>
                  <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {selected.notes}
                  </p>
                </section>
              ) : null}

              <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800/60">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                    Delivery progress
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
                    Track the primary delivery handoff stages and their recorded timestamps.
                  </p>
                </div>
                {isPaymongoAwaitingPayment(selected) ? (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-950/40">
                    <CreditCard
                      className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
                      aria-hidden="true"
                    />
                    <div>
                      <strong className="text-sm text-amber-950 dark:text-amber-100">
                        Awaiting PayMongo payment
                      </strong>
                      <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
                        Delivery processing is locked until PayMongo confirms this order as paid.
                      </p>
                    </div>
                  </div>
                ) : (
                  <StaffDeliveryProgress ticket={selected} />
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800/60">
                <h3 className="mb-1 text-sm font-semibold text-slate-950 dark:text-slate-100">
                  Ticket activity history
                </h3>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-300">
                  Recorded delivery updates, cancellation notes and payment confirmations.
                </p>
                <ScrollArea
                  style={{ height: Math.min(224, Math.max(66, selected.timeline.length * 72)) }}
                >
                  <ol className="space-y-3 pr-3">
                    {selected.timeline.map((event) => (
                      <li className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-600 dark:bg-slate-700/40" key={event.id}>
                        <div className="flex flex-wrap justify-between gap-2">
                          <strong className="text-xs text-slate-900 dark:text-slate-100">
                            {statusLabel(event.status)}
                          </strong>
                          <time className="text-xs text-slate-500 dark:text-slate-300">
                            {dateTimeFormatter.format(new Date(event.createdAt))}
                          </time>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                          {event.actorType}{event.note ? ` · ${event.note}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Order items
                </h3>
                <ScrollArea
                  className="rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800/40"
                  style={{ height: Math.min(300, Math.max(92, selected.items.length * 46)) }}
                  viewportClassName="pr-3"
                >
                  <div className="divide-y divide-slate-100 dark:divide-slate-600">
                    {selected.items.map((item) => (
                      <div
                        className="flex items-start justify-between gap-4 px-4 py-3"
                        key={item.productId}
                      >
                        <span className="text-sm text-slate-700 dark:text-slate-100">
                          {item.quantity} × {item.productName}
                        </span>
                        <strong className="shrink-0 text-sm text-slate-950 dark:text-slate-50">
                          {currencyFormatter.format(Number(item.totalAmount))}
                        </strong>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </section>

              {!["DELIVERED", "CANCELLED"].includes(selected.deliveryStatus) ? (
                <section className="grid gap-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-400/30 dark:bg-indigo-950/30">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                      Delivery operations
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      Courier booking stays manual. Record enough information for an auditable
                      handoff.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-3">
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Courier / service
                        <Select
                          onChange={(event) => {
                            const next = event.target.value;
                            setCourierProvider(next);
                            if (next !== "Other") setCustomCourierProvider("");
                          }}
                          value={courierProvider}
                        >
                          <option value="">Choose courier when dispatching</option>
                          <option value="Grab">Grab</option>
                          <option value="Lalamove">Lalamove</option>
                          <option value="Other">Other</option>
                        </Select>
                      </label>
                      {courierProvider === "Other" ? (
                        <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                          Other courier / service name
                          <Input
                            maxLength={80}
                            onChange={(event) => setCustomCourierProvider(event.target.value)}
                            placeholder="e.g. JoyRide, local courier, in-house rider"
                            value={customCourierProvider}
                          />
                        </label>
                      ) : null}
                    </div>

                    <label className="grid content-start gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Rider / booking reference
                      <Input
                        maxLength={120}
                        onChange={(event) => setCourierReference(event.target.value)}
                        placeholder="e.g. rider mobile, booking ID, plate number"
                        value={courierReference}
                      />
                      <span className="text-xs font-normal leading-5 text-slate-500 dark:text-slate-300">
                        Add the rider phone number or app booking ID when available so the handoff
                        can be verified.
                      </span>
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Internal staff note
                    <Input
                      maxLength={255}
                      onChange={(event) => setStaffNote(event.target.value)}
                      placeholder="Internal handoff note for owner/staff only"
                      value={staffNote}
                    />
                    <span className="text-xs font-normal leading-5 text-slate-500 dark:text-slate-300">
                      This operational note is not shown to the customer.
                    </span>
                  </label>
                </section>
              ) : null}

              {selected.customerConfirmedAt ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                  Customer confirmed receipt on{" "}
                  {dateTimeFormatter.format(new Date(selected.customerConfirmedAt))}.
                </div>
              ) : selected.deliveryStatus === "OUT_FOR_DELIVERY" ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-100">
                  Waiting for the customer to confirm physical receipt from My Account.
                </div>
              ) : null}
            </div>

            <DialogFooter className="flex-wrap">
              {selected.canConfirmCodCollected ? (
                <Button disabled={submitting} onClick={() => void settleCod()} type="button">
                  <Banknote className="h-4 w-4" aria-hidden="true" />
                  {submitting ? "Confirming..." : "Confirm COD collected"}
                </Button>
              ) : null}

              {selected.deliveryStatus === "ORDER_PLACED" &&
              !isPaymongoAwaitingPayment(selected) ? (
                <Button
                  disabled={submitting}
                  onClick={() => void runTransition("PREPARING")}
                  type="button"
                >
                  Start preparing
                </Button>
              ) : null}
              {selected.deliveryStatus === "PREPARING" ? (
                <Button
                  disabled={submitting}
                  onClick={() => void runTransition("READY_FOR_DELIVERY")}
                  type="button"
                >
                  Mark ready
                </Button>
              ) : null}
              {selected.deliveryStatus === "READY_FOR_DELIVERY" ? (
                <Button
                  disabled={submitting || !resolvedCourierProvider}
                  onClick={() => void runTransition("OUT_FOR_DELIVERY")}
                  type="button"
                >
                  <Truck className="h-4 w-4" aria-hidden="true" />
                  Dispatch order
                </Button>
              ) : null}
              {selected.deliveryStatus === "OUT_FOR_DELIVERY" ? (
                <Button
                  disabled={submitting}
                  onClick={() => void runTransition("DELIVERY_FAILED")}
                  type="button"
                  variant="danger"
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Delivery failed
                </Button>
              ) : null}
              {selected.deliveryStatus === "DELIVERY_FAILED" ? (
                <Button
                  disabled={submitting}
                  onClick={() => void runTransition("READY_FOR_DELIVERY")}
                  type="button"
                >
                  Ready for redelivery
                </Button>
              ) : null}

              {["ORDER_PLACED", "PREPARING", "READY_FOR_DELIVERY", "DELIVERY_FAILED"].includes(
                selected.deliveryStatus
              ) ? (
                <Button
                  disabled={submitting || selected.paymentStatus === "PAID"}
                  onClick={() => void runTransition("CANCELLED")}
                  type="button"
                  variant="ghost"
                >
                  Cancel order
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function StaffDeliveryProgress({ ticket }: { ticket: DeliveryTicket }) {
  const eventByStatus = new Map(ticket.timeline.map((event) => [event.status, event] as const));

  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-[650px] list-none px-1 pb-0 pt-1">
        {DELIVERY_PROGRESS_STEPS.map((step, index) => {
          const event = eventByStatus.get(step.status);
          const isCurrent = ticket.deliveryStatus === step.status;

          return (
            <li className="min-w-0 flex-1" key={step.status}>
              <div className="flex min-h-7 items-center">
                <span
                  className={[
                    "grid h-7 w-7 flex-none place-items-center rounded-full border text-xs font-semibold",
                    event
                      ? "border-transparent bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100",
                    isCurrent ? "ring-4 ring-indigo-100 dark:ring-indigo-400/30" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {event ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                {index < DELIVERY_PROGRESS_STEPS.length - 1 ? (
                  <span
                    className={`mx-2 h-px flex-1 ${event ? "bg-indigo-300 dark:bg-indigo-400/70" : "bg-slate-200 dark:bg-slate-600"}`}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <div className="mt-2 pr-3">
                <strong className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {step.label}
                </strong>
                <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-300">
                  {event ? dateTimeFormatter.format(new Date(event.createdAt)) : "Pending"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof PackageCheck;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TicketFact({
  detail,
  icon: Icon,
  label,
  value
}: {
  detail: string;
  icon: typeof PackageCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-600 dark:bg-slate-800/40">
      <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-indigo-400/15 dark:text-indigo-200">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-300">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{value}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-300">{detail}</p>
      </div>
    </div>
  );
}
