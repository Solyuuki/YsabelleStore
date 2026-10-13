import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Clock3,
  Inbox,
  Mail,
  MessageSquareText,
  PackageSearch,
  RefreshCw,
  Search,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchStaffSupportTicket,
  fetchStaffSupportTickets,
  fetchSupportGmailStatus,
  replyToStaffSupportTicket,
  retryStaffSupportMessageEmail,
  syncSupportGmail,
  updateStaffSupportTicketStatus
} from "@/services/supportApi";
import {
  STAFF_SUPPORT_CATEGORIES,
  STAFF_SUPPORT_STATUSES,
  type StaffSupportCategory,
  type StaffSupportMessage,
  type StaffSupportStatus,
  type StaffSupportTicketDetail,
  type StaffSupportTicketSummary,
  type SupportGmailStatus
} from "@/types/staffSupport";
import type { StorefrontPagination } from "@/types/storefront";
import "@/styles/retail-support-mobile-v2.css";

const STATUS_LABELS: Record<StaffSupportStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  WAITING_FOR_CUSTOMER: "Waiting for customer",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};

const CATEGORY_LABELS: Record<StaffSupportCategory, string> = {
  ORDER: "Order",
  PAYMENT: "Payment",
  PRODUCT: "Product",
  PICKUP_DELIVERY: "Pickup / delivery",
  ACCOUNT: "Account",
  RETURN_REFUND: "Return / refund",
  FEEDBACK: "Feedback",
  OTHER: "Other"
};

const STATUS_TRANSITIONS: Record<StaffSupportStatus, readonly StaffSupportStatus[]> = {
  NEW: ["OPEN", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"],
  OPEN: ["WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"],
  WAITING_FOR_CUSTOMER: ["OPEN", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: ["OPEN"]
};

const EMPTY_META: StorefrontPagination = {
  page: 1,
  pageSize: 25,
  totalItems: 0,
  totalPages: 1
};

// Display normalization for already-imported emails whose quoted history was stored
// before the backend began trimming reply content during Gmail sync.
function customerReplyText(raw: string) {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  let cutoff = lines.length;

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    const preview = lines
      .slice(index, index + 3)
      .map((part) => part.trim())
      .join(" ");
    const gmailQuote =
      /^On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i.test(line) && /\bwrote\s*:/i.test(preview);
    const outlookQuote =
      /^From:\s*.+/i.test(line) &&
      lines
        .slice(index + 1, index + 5)
        .some((part) => /^(?:Sent|To|Subject):\s*/i.test(part.trim()));
    const quotedLine = index > 0 && line.startsWith(">") && !(lines[index - 1] ?? "").trim();

    if (
      gmailQuote ||
      outlookQuote ||
      /^-{2,}\s*Original Message\s*-{2,}$/i.test(line) ||
      /^Begin forwarded message:\s*$/i.test(line) ||
      quotedLine
    ) {
      cutoff = index;
      break;
    }
  }

  return lines.slice(0, cutoff).join("\n").trim();
}

function formatDateTime(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function supportError(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

export function CustomerSupportInboxPage() {
  const [tickets, setTickets] = useState<StaffSupportTicketSummary[]>([]);
  const [meta, setMeta] = useState<StorefrontPagination>(EMPTY_META);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const statusChipsRef = useRef<HTMLDivElement>(null);
  const [statusChipsScroll, setStatusChipsScroll] = useState({
    canGoBack: false,
    canGoForward: false,
    hasOverflow: false
  });
  const mobileConversationOpenRef = useRef(false);
  const [detail, setDetail] = useState<StaffSupportTicketDetail | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StaffSupportStatus | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<StaffSupportCategory | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [syncingInbox, setSyncingInbox] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [statusDraft, setStatusDraft] = useState<StaffSupportStatus>("NEW");
  const [statusSaving, setStatusSaving] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<SupportGmailStatus | null>(null);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);

  useEffect(() => {
    mobileConversationOpenRef.current = mobileConversationOpen;
  }, [mobileConversationOpen]);
  // The status strip is horizontally scrollable, so arrows must reflect the
  // actual available width (including narrow embedded mobile-preview frames).
  useEffect(() => {
    const strip = statusChipsRef.current;
    if (!strip) return;

    const updateScrollControls = () => {
      const limit = Math.max(0, strip.scrollWidth - strip.clientWidth);
      const next = {
        canGoBack: strip.scrollLeft > 1,
        canGoForward: strip.scrollLeft < limit - 1,
        hasOverflow: limit > 1
      };
      setStatusChipsScroll((current) =>
        current.canGoBack === next.canGoBack &&
        current.canGoForward === next.canGoForward &&
        current.hasOverflow === next.hasOverflow
          ? current
          : next
      );
    };

    updateScrollControls();
    strip.addEventListener("scroll", updateScrollControls, { passive: true });
    window.addEventListener("resize", updateScrollControls);

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollControls);
    observer?.observe(strip);
    return () => {
      observer?.disconnect();
      strip.removeEventListener("scroll", updateScrollControls);
      window.removeEventListener("resize", updateScrollControls);
    };
  }, []);

  function scrollStatusChips(direction: -1 | 1) {
    const strip = statusChipsRef.current;
    if (!strip) return;
    strip.scrollBy({
      left: direction * Math.max(130, strip.clientWidth * 0.8),
      behavior: "smooth"
    });
  }

  useEffect(() => {
    void fetchSupportGmailStatus()
      .then(setGmailStatus)
      .catch(() => setGmailStatus({ configured: false, mailbox: null }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setListLoading(true);
      setError(null);

      void fetchStaffSupportTickets(
        {
          status: statusFilter === "ALL" ? undefined : statusFilter,
          category: categoryFilter === "ALL" ? undefined : categoryFilter,
          search: search.trim() || undefined,
          page,
          pageSize: 25
        },
        controller.signal
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          setTickets(result.items);
          setMeta(result.meta);
          setSelectedTicketId((current) => {
            if (
              current &&
              (mobileConversationOpenRef.current || result.items.some((ticket) => ticket.id === current))
            ) {
              return current;
            }
            return result.items[0]?.id ?? null;
          });
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setError(supportError(reason, "Support tickets could not be loaded."));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setListLoading(false);
        });
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [categoryFilter, page, reloadKey, search, statusFilter]);

  useEffect(() => {
    if (!selectedTicketId) {
      setDetail(null);
      return;
    }

    const controller = new AbortController();
    setDetailLoading(true);
    setError(null);

    void fetchStaffSupportTicket(selectedTicketId, controller.signal)
      .then((ticket) => {
        if (controller.signal.aborted) return;
        setDetail(ticket);
        setStatusDraft(ticket.status);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(supportError(reason, "Support conversation could not be loaded."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });

    return () => controller.abort();
  }, [selectedTicketId, reloadKey]);

  const statusOptions = useMemo(() => {
    if (!detail) return STAFF_SUPPORT_STATUSES;
    return [detail.status, ...STATUS_TRANSITIONS[detail.status]];
  }, [detail]);

  function resetToFirstPage() {
    setPage(1);
  }

  async function refreshSupportInbox() {
    if (syncingInbox) return;
    setSyncingInbox(true);
    setError(null);
    try {
      if (gmailStatus?.configured) {
        await syncSupportGmail();
      }
      setReloadKey((value) => value + 1);
    } catch (reason) {
      setError(supportError(reason, "Gmail synchronization failed. Try refreshing again."));
    } finally {
      setSyncingInbox(false);
    }
  }

  async function saveStatus(nextStatus: StaffSupportStatus = statusDraft) {
    if (!detail || nextStatus === detail.status || statusSaving) return;
    if (
      nextStatus === "RESOLVED" &&
      !window.confirm(
        "Send a resolution confirmation email? The ticket stays pending until the customer replies YES or NO in Gmail."
      )
    ) {
      setStatusDraft(detail.status);
      return;
    }
    setStatusSaving(true);
    setError(null);
    try {
      const updated = await updateStaffSupportTicketStatus(detail.id, nextStatus);
      setDetail(updated);
      setStatusDraft(updated.status);
      setReloadKey((value) => value + 1);
    } catch (reason) {
      setStatusDraft(detail.status);
      setError(supportError(reason, "Ticket status could not be updated."));
    } finally {
      setStatusSaving(false);
    }
  }

  async function retryEmail(messageId: string) {
    if (!detail || retryingMessageId) return;
    setRetryingMessageId(messageId);
    setError(null);
    try {
      const updated = await retryStaffSupportMessageEmail(detail.id, messageId);
      setDetail(updated);
      setReloadKey((value) => value + 1);
      const retried = updated.messages.find((message) => message.id === messageId);
      if (retried?.deliveryStatus === "FAILED") {
        setError("The reply remains saved, but Gmail delivery failed again.");
      }
    } catch (reason) {
      setError(supportError(reason, "Support email could not be retried."));
    } finally {
      setRetryingMessageId(null);
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || replySaving || detail.status === "CLOSED" || gmailStatus?.configured !== true) {
      return;
    }

    const message = reply.trim();
    if (!message) {
      setError("Enter a reply before saving.");
      return;
    }

    setReplySaving(true);
    setError(null);
    try {
      const updated = await replyToStaffSupportTicket(detail.id, message);
      setDetail(updated);
      setStatusDraft(updated.status);
      setReply("");
      setReloadKey((value) => value + 1);
      const latestStaffMessage = [...updated.messages]
        .reverse()
        .find((item) => item.senderType === "STAFF");
      if (latestStaffMessage?.deliveryStatus === "FAILED") {
        setError("Reply saved to the ticket, but Gmail delivery failed. Use Retry email.");
      }
    } catch (reason) {
      setError(supportError(reason, "Support reply could not be saved."));
    } finally {
      setReplySaving(false);
    }
  }

  return (
    <div className="ys-support-page">
      <div className="ys-support-desktop-page-header">
      <PageHeader
        actions={
          <>
            <StatusBadge variant={gmailStatus?.configured ? "success" : "warning"}>
              {gmailStatus?.configured ? "Gmail connected" : "Gmail setup required"}
            </StatusBadge>
            <Button
              onClick={() => void refreshSupportInbox()}
              disabled={syncingInbox}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {syncingInbox ? "Syncing..." : "Refresh"}
            </Button>
          </>
        }
        description="Review customer concerns, keep conversation history together, and manage ticket lifecycle from one staff workspace."
        eyebrow="Customer care"
        title="Support"
      />
      </div>

      {error ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="ys-support-inbox grid h-[clamp(740px,calc(100dvh-13.5rem),880px)] min-h-[680px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[390px_minmax(0,1fr)]" data-mobile-conversation={mobileConversationOpen}>
        <aside className="ys-support-list-panel flex min-h-0 flex-col border-b border-slate-200 xl:border-b-0 xl:border-r">
          <div className="ys-support-mobile-inbox-heading">
            <h2>Support</h2>
            <span>{gmailStatus?.configured ? "Gmail connected" : "Gmail unavailable"}</span>
            <button aria-label="Refresh support inbox" disabled={syncingInbox} onClick={() => void refreshSupportInbox()} type="button"><RefreshCw className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <div className="ys-support-list-filters space-y-3 border-b border-slate-200 p-4">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <Input
                aria-label="Search support conversations"
                className="pl-9"
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetToFirstPage();
                }}
                placeholder="Search conversations"
                value={search}
              />
            </div>
            <div className="ys-support-mobile-status-toolbar">
              <div
                aria-label="Support status filters, scroll horizontally for more choices"
                className="ys-support-mobile-status-chips"
                ref={statusChipsRef}
                role="group"
              >
                {(["ALL", ...STAFF_SUPPORT_STATUSES] as const).map((filter) => (
                  <button
                    aria-pressed={statusFilter === filter}
                    className="ys-support-status-chip"
                    key={filter}
                    onClick={() => { setStatusFilter(filter); resetToFirstPage(); }}
                    type="button"
                  >
                    {filter === "ALL" ? "All" : STATUS_LABELS[filter]}
                  </button>
                ))}
              </div>
              <div
                aria-label="More status choices"
                className="ys-support-status-scroll-buttons"
                data-scrollable={statusChipsScroll.hasOverflow}
                role="group"
              >
                <span className="ys-support-scroll-hint">Swipe to see more</span>
                <button
                  aria-label="Previous status choices"
                  disabled={!statusChipsScroll.canGoBack}
                  onClick={() => scrollStatusChips(-1)}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  aria-label="Next status choices"
                  disabled={!statusChipsScroll.canGoForward}
                  onClick={() => scrollStatusChips(1)}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>
            <button aria-controls="ys-support-extra-filters" aria-expanded={mobileFiltersOpen}
              className="ys-support-mobile-filter-toggle" onClick={() => setMobileFiltersOpen((value) => !value)} type="button">
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" /> More filters
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </button>
            <div className="ys-support-filter-row grid grid-cols-2 gap-2" data-open={mobileFiltersOpen} id="ys-support-extra-filters">
              <FilterSelect
                label="Status"
                onChange={(value) => {
                  setStatusFilter(value as StaffSupportStatus | "ALL");
                  resetToFirstPage();
                }}
                value={statusFilter}
              >
                <option value="ALL">All statuses</option>
                {STAFF_SUPPORT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Category"
                onChange={(value) => {
                  setCategoryFilter(value as StaffSupportCategory | "ALL");
                  resetToFirstPage();
                }}
                value={categoryFilter}
              >
                <option value="ALL">All categories</option>
                {STAFF_SUPPORT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </FilterSelect>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{meta.totalItems} ticket(s)</span>
              <span>
                Page {meta.page} of {meta.totalPages}
              </span>
            </div>
          </div>

          <div className="ys-support-ticket-list min-h-0 flex-1 overflow-y-auto">
            {listLoading ? (
              <SupportInboxState label="Loading support inbox..." />
            ) : tickets.length === 0 ? (
              <SupportInboxState label="No support tickets match these filters." />
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <TicketListItem
                    active={ticket.id === selectedTicketId}
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setMobileConversationOpen(true);
                    }}
                    ticket={ticket}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="ys-support-list-pagination flex items-center justify-between gap-2 border-t border-slate-200 p-3">
            <Button
              disabled={page <= 1 || listLoading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              size="sm"
              type="button"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              disabled={page >= meta.totalPages || listLoading}
              onClick={() => setPage((value) => value + 1)}
              size="sm"
              type="button"
              variant="secondary"
            >
              Next
            </Button>
          </div>
        </aside>

        <div className="ys-support-inbox__conversation min-h-0 min-w-0">
          <button
            className="ys-support-inbox__mobile-back"
            onClick={() => setMobileConversationOpen(false)}
            type="button"
          >
            Back to tickets
          </button>
          {!selectedTicketId ? (
            <EmptyConversation />
          ) : detailLoading || (detail && detail.id !== selectedTicketId) ? (
            <EmptyConversation label="Loading conversation..." />
          ) : detail && detail.id === selectedTicketId ? (
            <SupportConversation
              key={detail.id}
              detail={detail}
              gmailConfigured={gmailStatus?.configured === true}
              onBack={() => {
                setMobileConversationOpen(false);
                if (!tickets.some((ticket) => ticket.id === selectedTicketId)) {
                  setSelectedTicketId(tickets[0]?.id ?? null);
                }
              }}
              onReopen={() => void saveStatus("OPEN")}
              onReplyChange={setReply}
              onReplySubmit={submitReply}
              onRetryEmail={(messageId) => void retryEmail(messageId)}
              onStatusChange={(status) => setStatusDraft(status)}
              onStatusSave={() => void saveStatus()}
              reply={reply}
              replySaving={replySaving}
              retryingMessageId={retryingMessageId}
              statusDraft={statusDraft}
              statusOptions={statusOptions}
              statusSaving={statusSaving}
            />
          ) : (
            <EmptyConversation label="Conversation could not be loaded." />
          )}
        </div>
      </section>
    </div>
  );
}

function FilterSelect({
  children,
  label,
  onChange,
  value
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="ys-support-filter-field grid gap-1 text-xs font-medium text-slate-500">
      <span>{label}</span>
      <select
        aria-label={label}
        className="ys-support-filter-select ys-retail-select-chevron h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function SupportInboxState({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center px-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function TicketListItem({
  active,
  onClick,
  ticket
}: {
  active: boolean;
  onClick: () => void;
  ticket: StaffSupportTicketSummary;
}) {
  return (
    <button
      className={[
        "ys-support-ticket w-full px-4 py-4 text-left transition-colors",
        active ? "bg-indigo-50/80" : "bg-white hover:bg-slate-50"
      ].join(" ")}
      aria-pressed={active}
      data-active={active}
      onClick={onClick}
      type="button"
    >
      <div className="ys-support-ticket-line flex items-start justify-between gap-3">
        <span className="ys-support-ticket-avatar" aria-hidden="true">{ticket.customerName.trim().charAt(0).toUpperCase() || "?"}</span>
        <div className="ys-support-ticket-main min-w-0">
          <p className="ys-support-ticket-number truncate text-xs font-bold tracking-wide text-indigo-700">
            {ticket.ticketNumber}
          </p>
          <p className="ys-support-ticket-subject mt-1 truncate text-sm font-semibold text-slate-950">{ticket.subject}</p>
        </div>
        <SupportStatusBadge status={ticket.status} />
      </div>
      <p className="ys-support-ticket-customer mt-2 truncate text-xs text-slate-500">
        {ticket.customerName} · {CATEGORY_LABELS[ticket.category]}
      </p>
      <div className="ys-support-ticket-bottom mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>{ticket.messageCount} message(s)</span>
        <span>{formatDateTime(ticket.lastMessageAt)}</span>
      </div>
    </button>
  );
}

function SupportConversation({
  detail,
  gmailConfigured,
  onBack,
  onReopen,
  onReplyChange,
  onReplySubmit,
  onRetryEmail,
  onStatusChange,
  onStatusSave,
  reply,
  replySaving,
  retryingMessageId,
  statusDraft,
  statusOptions,
  statusSaving
}: {
  detail: StaffSupportTicketDetail;
  gmailConfigured: boolean;
  onBack: () => void;
  onReopen: () => void;
  onReplyChange: (value: string) => void;
  onReplySubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetryEmail: (messageId: string) => void;
  onStatusChange: (status: StaffSupportStatus) => void;
  onStatusSave: () => void;
  reply: string;
  replySaving: boolean;
  retryingMessageId: string | null;
  statusDraft: StaffSupportStatus;
  statusOptions: readonly StaffSupportStatus[];
  statusSaving: boolean;
}) {
  const statusChanged = statusDraft !== detail.status;
  const [replyComposerExpanded, setReplyComposerExpanded] = useState(false);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const mobileThreadRef = useRef<HTMLDivElement>(null);
  const mobileConversationRef = useRef<HTMLDivElement>(null);

  // Mobile-preview iframes and tall email bubbles can pass wheel events to the
  // outer workspace instead of the chat. Intercept only wheel movement inside
  // the message viewport and forward it to the actual scroll container.
  // A native non-passive capture listener is required: React wheel listeners
  // can be passive and cannot reliably cancel outer-page scrolling.
  useEffect(() => {
    const conversation = mobileConversationRef.current;
    const thread = mobileThreadRef.current;
    if (!conversation || !thread) return;

    const wheelMessages = (event: WheelEvent) => {
      if (
        !window.matchMedia("(max-width: 1024px)").matches ||
        event.defaultPrevented ||
        event.ctrlKey
      ) {
        return;
      }

      const bounds = thread.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        return;
      }

      const maxScroll = Math.max(0, thread.scrollHeight - thread.clientHeight);
      if (maxScroll <= 1 || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;

      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? thread.clientHeight : 1;
      const scrollAmount = event.deltaY * multiplier;
      if (Math.abs(scrollAmount) < 0.01) return;

      event.preventDefault();
      thread.scrollTop = Math.max(0, Math.min(maxScroll, thread.scrollTop + scrollAmount));
    };

    conversation.addEventListener("wheel", wheelMessages, { capture: true, passive: false });
    return () => conversation.removeEventListener("wheel", wheelMessages, true);
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 1024px)").matches) return;
    const thread = mobileThreadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [detail.id, detail.messages.length]);

  return (
    <div className="ys-support-conversation-layout flex h-full min-h-0 flex-col" ref={mobileConversationRef}>
      <div className="ys-support-mobile-chat-header">
        <button aria-label="Back to conversations" className="ys-support-mobile-chat-back" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <span className="ys-support-mobile-chat-avatar" aria-hidden="true">{detail.customerName.trim().charAt(0).toUpperCase() || "?"}</span>
        <div className="ys-support-mobile-chat-title">
          <strong>{detail.subject}</strong>
          <span>{detail.ticketNumber} · {STATUS_LABELS[detail.status]}</span>
        </div>
        <button aria-controls={`support-details-${detail.id}`} aria-expanded={mobileDetailsOpen}
          aria-label={mobileDetailsOpen ? "Hide ticket details and status" : "Show ticket details and status"}
          className="ys-support-mobile-info" onClick={() => setMobileDetailsOpen((value) => !value)} type="button">
          <Info aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <section aria-label="Ticket details and status" className="ys-support-mobile-ticket-details"
        data-open={mobileDetailsOpen} id={`support-details-${detail.id}`}>
        <div className="ys-support-mobile-ticket-meta">
          <SupportFact icon={UserRound} label="Customer" value={detail.customerName} />
          <SupportFact icon={Mail} label="Email" value={detail.customerEmail} />
          <SupportFact icon={PackageSearch} label="Order" value={detail.customerOrder?.orderNumber ?? "Not linked"} />
          <SupportFact icon={Clock3} label="Last activity" value={formatDateTime(detail.lastMessageAt)} />
        </div>
        <div className="ys-support-mobile-status-editor">
          <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium text-slate-500">
            <span>Ticket status</span>
            <select aria-label="Ticket status" className="ys-retail-select-chevron h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={statusSaving} onChange={(event) => onStatusChange(event.target.value as StaffSupportStatus)} value={statusDraft}>
              {statusOptions.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <Button disabled={!statusChanged || statusSaving} onClick={onStatusSave} size="sm" type="button">
            {statusSaving ? "Saving..." : "Update"}
          </Button>
        </div>
      </section>
      <header className="ys-support-desktop-conversation-header border-b border-slate-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold tracking-wide text-indigo-700">
                {detail.ticketNumber}
              </p>
              <SupportStatusBadge status={detail.status} />
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{detail.subject}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {CATEGORY_LABELS[detail.category]} · Created {formatDateTime(detail.createdAt)}
            </p>
          </div>

          <div className="flex min-w-[250px] items-end gap-2">
            <label className="grid flex-1 gap-1 text-xs font-medium text-slate-500">
              <span>Ticket status</span>
              <select
                className="ys-retail-select-chevron h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={statusSaving}
                onChange={(event) => onStatusChange(event.target.value as StaffSupportStatus)}
                value={statusDraft}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!statusChanged || statusSaving}
              onClick={onStatusSave}
              size="sm"
              type="button"
            >
              {statusSaving ? "Saving..." : "Update"}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SupportFact icon={UserRound} label="Customer" value={detail.customerName} />
          <SupportFact icon={Mail} label="Email" value={detail.customerEmail} />
          <SupportFact
            icon={PackageSearch}
            label="Order"
            value={detail.customerOrder?.orderNumber ?? "Not linked"}
          />
          <SupportFact
            icon={Clock3}
            label="Last activity"
            value={formatDateTime(detail.lastMessageAt)}
          />
        </div>
      </header>

      <div
        aria-label="Conversation messages"
        className="ys-support-thread min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-slate-50/70 p-5"
        ref={mobileThreadRef}
        role="region"
        tabIndex={0}
      >
        <div className="mx-auto max-w-4xl space-y-3">
          {detail.messages.map((message) => (
            <ConversationMessage
              key={message.id}
              message={message}
              onRetryEmail={onRetryEmail}
              retrying={retryingMessageId === message.id}
            />
          ))}
        </div>
      </div>

      <form className="ys-support-mobile-composer" onSubmit={onReplySubmit}>
        {detail.status === "CLOSED" ? (
          <button className="ys-support-mobile-reopen" disabled={statusSaving} onClick={onReopen} type="button">
            <RotateCcw aria-hidden="true" className="h-4 w-4" /> {statusSaving ? "Reopening..." : "Reopen this ticket to reply"}
          </button>
        ) : !gmailConfigured ? (
          <p className="ys-support-mobile-email-warning">Gmail must be connected before a customer reply can be sent.</p>
        ) : (
          <div className="ys-support-mobile-compose-row">
            <Textarea aria-label="Write a support reply" disabled={replySaving} maxLength={5000}
              onChange={(event) => onReplyChange(event.target.value)} placeholder="Message customer..." rows={1} value={reply} />
            <Button aria-label="Send customer reply" disabled={replySaving || !reply.trim()} size="icon" type="submit">
              <Send aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        )}
      </form>
      <form
        className="ys-support-reply-form ys-support-desktop-reply-form shrink-0 border-t border-slate-200 bg-white px-4 py-3"
        onSubmit={onReplySubmit}
      >
        <div className="mx-auto max-w-4xl">
          {replyComposerExpanded ? (
            <div
              id={`staff-reply-editor-${detail.id}`}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setReplyComposerExpanded(false);
                }
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Staff reply</p>
                  <p className="text-xs text-slate-500">
                    Send a reply in the existing Gmail conversation.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-slate-400">{reply.length} / 5,000</span>
                  <button
                    aria-label="Minimize reply editor"
                    className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    disabled={replySaving}
                    onClick={() => setReplyComposerExpanded(false)}
                    title="Minimize reply editor"
                    type="button"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <Textarea
                autoFocus
                disabled={replySaving || detail.status === "CLOSED" || !gmailConfigured}
                maxLength={5000}
                onChange={(event) => onReplyChange(event.target.value)}
                placeholder={
                  detail.status === "CLOSED"
                    ? "Reopen this ticket before replying."
                    : !gmailConfigured
                      ? "Gmail must be connected before a customer reply can be sent."
                      : "Write a clear response for this customer..."
                }
                rows={4}
                value={reply}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {
                    "Successful delivery moves the ticket to Waiting for customer. Failed delivery keeps the ticket Open for follow-up."
                  }
                </p>
                <Button
                  disabled={
                    replySaving || detail.status === "CLOSED" || !gmailConfigured || !reply.trim()
                  }
                  type="submit"
                >
                  <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  {replySaving ? "Saving reply..." : "Save reply"}
                </Button>
              </div>
            </div>
          ) : (
            <button
              aria-expanded={false}
              aria-label="Open staff reply editor"
              className="ys-support-reply-trigger group flex min-h-11 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              onClick={() => setReplyComposerExpanded(true)}
              type="button"
            >
              <MessageSquareText
                className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-indigo-600"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
                {reply.trim()
                  ? reply.trim().replace(/\s+/g, " ")
                  : detail.status === "CLOSED"
                    ? "Reopen this ticket to reply."
                    : !gmailConfigured
                      ? "Connect Gmail before replying."
                      : "Write a reply to this customer..."}
              </span>
              {reply.trim() ? (
                <span className="shrink-0 text-xs font-medium text-indigo-600">Draft</span>
              ) : null}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function ConversationMessage({
  message,
  onRetryEmail,
  retrying
}: {
  message: StaffSupportMessage;
  onRetryEmail: (messageId: string) => void;
  retrying: boolean;
}) {
  const automatedEmail = message.senderType === "SYSTEM" && message.channel === "EMAIL";
  const systemText = message.body.startsWith("YS_SUPPORT_RESOLUTION_CONFIRMED:")
    ? "Customer confirmed that the concern is resolved. Staff may now mark this ticket Resolved."
    : message.body.startsWith("YS_SUPPORT_RESOLUTION_NEEDS_HELP:")
      ? "Customer needs more help. Ticket reopened."
      : message.body;

  if (message.senderType === "SYSTEM" && !automatedEmail) {
    return (
      <div className="flex justify-center py-1">
        <div className="ys-support-system-event rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm">
          {systemText}
        </div>
      </div>
    );
  }

  if (automatedEmail) {
    return (
      <div className="flex justify-center py-1">
        <article className="ys-support-automated-email min-w-0 max-w-[82%] rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-slate-800 shadow-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-indigo-700">
            <strong>
              {message.senderName === "Ysabelle Store Support Lifecycle"
                ? "Automated status update"
                : "Automated acknowledgement"}
            </strong>
            <span>·</span>
            <span>{formatDateTime(message.createdAt)}</span>
            <span>·</span>
            <span>EMAIL</span>
          </div>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-6">
            {message.body}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px] text-indigo-700">
            <span>
              {message.deliveryStatus === "SENT"
                ? "Email sent"
                : message.deliveryStatus === "FAILED"
                  ? "Email failed"
                  : "Email pending"}
            </span>
            {message.deliveryStatus === "FAILED" ? (
              <button
                className="rounded-md border border-indigo-300 px-2 py-1 font-semibold hover:bg-indigo-100 disabled:opacity-60"
                disabled={retrying}
                onClick={() => onRetryEmail(message.id)}
                type="button"
              >
                {retrying ? "Retrying..." : "Retry email"}
              </button>
            ) : null}
          </div>
        </article>
      </div>
    );
  }

  const staff = message.senderType === "STAFF";
  const resolutionRequest = message.body.startsWith("YS_SUPPORT_RESOLUTION_EMAIL_REPLY:");
  const displayBody = resolutionRequest
    ? "Resolution confirmation requested. Customer should reply YES or NO directly to the same email thread within 72 hours."
    : !staff && message.channel === "EMAIL"
      ? customerReplyText(message.body) || "No new reply text"
      : message.body;

  return (
    <div className={staff ? "flex justify-end" : "flex justify-start"}>
      <article
        className={[
          "min-w-0 max-w-[82%] rounded-2xl px-4 py-3 shadow-sm",
          staff
            ? "rounded-br-md bg-indigo-600 text-white"
            : "ys-support-customer-message rounded-bl-md border border-slate-200 bg-white text-slate-800"
        ].join(" ")}
      >
        <div
          className={[
            "mb-1 flex flex-wrap items-center gap-2 text-xs",
            staff ? "text-indigo-100" : "text-slate-500"
          ].join(" ")}
        >
          <strong>{message.senderName ?? (staff ? "Store staff" : "Customer")}</strong>
          <span>·</span>
          <span>{formatDateTime(message.createdAt)}</span>
          <span>·</span>
          <span>{message.channel}</span>
        </div>
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-6">
          {displayBody}
        </p>
        {staff && message.channel === "EMAIL" ? (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px]">
            <span>
              {message.deliveryStatus === "SENT"
                ? "Email sent"
                : message.deliveryStatus === "FAILED"
                  ? "Email failed"
                  : "Email pending"}
            </span>
            {message.deliveryStatus === "FAILED" ? (
              <button
                className="rounded-md border border-white/35 px-2 py-1 font-semibold hover:bg-white/10 disabled:opacity-60"
                disabled={retrying}
                onClick={() => onRetryEmail(message.id)}
                type="button"
              >
                {retrying ? "Retrying..." : "Retry email"}
              </button>
            ) : null}
          </div>
        ) : null}
      </article>
    </div>
  );
}

function SupportFact({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Inbox;
  label: string;
  value: string;
}) {
  return (
    <div className="ys-support-fact rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-slate-800" title={value}>
        {value}
      </p>
    </div>
  );
}

function SupportStatusBadge({ status }: { status: StaffSupportStatus }) {
  const variant =
    status === "RESOLVED"
      ? "success"
      : status === "WAITING_FOR_CUSTOMER"
        ? "warning"
        : status === "CLOSED"
          ? "protected"
          : "info";

  return <StatusBadge variant={variant}>{STATUS_LABELS[status]}</StatusBadge>;
}

function EmptyConversation({ label = "Select a support ticket to open the conversation." }) {
  return (
    <div className="flex min-h-[680px] items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <Inbox className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-slate-900">Support conversation</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{label}</p>
      </div>
    </div>
  );
}
