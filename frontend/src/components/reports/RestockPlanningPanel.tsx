import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  RefreshCw,
  Search,
  Settings2,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateProduct } from "@/services/catalogApi";
import {
  approveRestockOrder,
  createRestockOrder,
  dismissRestockRecommendation,
  listRestockPlanning,
  replaceRestockOrderLines,
  type RestockDraftLineInput,
  type RestockOrder,
  type RestockPlanningCandidate,
  type RestockRecommendationSource
} from "@/services/restockApi";

const RESTOCK_PAGE_SIZE = 8;
const CATALOG_PAGE_SIZE = 10;
const REVIEW_PAGE_SIZE = 12;

type PlanLine = {
  candidate: RestockPlanningCandidate;
  isSelected: boolean;
  notes: string;
  ownerOverrideReason: string;
  policyReorderLevel: number;
  policyTargetStockLevel: number;
  recommendationId: string | null;
  recommendationSource: RestockRecommendationSource;
  recommendedQuantity: number;
  requestedQuantity: number;
};

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

function asNonNegativeInteger(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function makePlanLine(candidate: RestockPlanningCandidate, manual = false): PlanLine {
  const recommendedQuantity = manual ? 0 : candidate.recommendedQuantity;

  return {
    candidate,
    isSelected: manual ? true : recommendedQuantity > 0,
    notes: "",
    ownerOverrideReason: "",
    policyReorderLevel: candidate.product.reorderLevel,
    policyTargetStockLevel: candidate.product.targetStockLevel,
    recommendationId: manual ? null : candidate.recommendationId,
    recommendationSource: manual ? "MANUAL" : candidate.recommendationSource,
    recommendedQuantity,
    requestedQuantity: manual ? 1 : recommendedQuantity
  };
}

function toDraftLine(line: PlanLine): RestockDraftLineInput {
  return {
    productId: line.candidate.product.id,
    recommendationId: line.recommendationId,
    recommendationSource: line.recommendationSource,
    recommendedQuantity: line.recommendedQuantity,
    requestedQuantity: line.requestedQuantity,
    isSelected: line.isSelected,
    ownerOverrideReason: line.ownerOverrideReason.trim() || null,
    notes: line.notes.trim() || null
  };
}

function needsOverrideReason(line: PlanLine) {
  return (
    line.recommendationSource !== "MANUAL" && line.requestedQuantity !== line.recommendedQuantity
  );
}

function validatePlan(lines: PlanLine[]) {
  if (lines.length === 0) return "Add at least one product to the restock list.";

  const selected = lines.filter((line) => line.isSelected);
  if (selected.length === 0) return "Include at least one product before reviewing the restock.";
  if (selected.some((line) => line.requestedQuantity < 1)) {
    return "Every included product needs an order quantity greater than zero.";
  }

  const missingReason = selected.find(
    (line) => needsOverrideReason(line) && line.ownerOverrideReason.trim().length === 0
  );
  if (missingReason) {
    return `Add a reason for changing ${missingReason.candidate.product.name}'s suggested quantity.`;
  }

  return null;
}

function statusVariant(status: RestockOrder["status"]) {
  if (status === "APPROVED" || status === "RECEIVED") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "PARTIALLY_RECEIVED" || status === "AWAITING_DELIVERY") {
    return "warning" as const;
  }
  return "info" as const;
}

function statusLabel(status: RestockOrder["status"]) {
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

function clampPage(page: number, totalItems: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(1, page), totalPages);
}

type RestockPlanningPanelProps = {
  onOpenOrders: () => void;
  onOrdersChanged: () => void;
};

export function RestockPlanningPanel({ onOpenOrders, onOrdersChanged }: RestockPlanningPanelProps) {
  const [lines, setLines] = useState<PlanLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [draftOrder, setDraftOrder] = useState<RestockOrder | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [dismissReasons, setDismissReasons] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RestockPlanningCandidate[]>([]);
  const [catalogMeta, setCatalogMeta] = useState<PaginationMeta | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [restockPage, setRestockPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(() => new Set());
  const confirmLockRef = useRef(false);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const result = await listRestockPlanning({ page: 1, pageSize: 100 });
      setLines(result.items.map((candidate) => makePlanLine(candidate)));
      setDraftOrder(null);
      setDraftDirty(false);
      setDraftNotes("");
      setSearchTerm("");
      setSearchResults([]);
      setCatalogMeta(null);
      setCatalogError(null);
      setCatalogOpen(false);
      setReviewOpen(false);
      setRestockPage(1);
      setReviewPage(1);
      setExpandedProductIds(new Set());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Restock recommendations could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  const selectedLines = useMemo(() => lines.filter((line) => line.isSelected), [lines]);
  const selectedCount = selectedLines.length;
  const requestedUnits = useMemo(
    () => selectedLines.reduce((sum, line) => sum + Math.max(0, line.requestedQuantity), 0),
    [selectedLines]
  );
  const overrideCount = useMemo(
    () => selectedLines.filter((line) => needsOverrideReason(line)).length,
    [selectedLines]
  );
  const editable = !draftOrder || draftOrder.status === "DRAFT";
  const lineIds = useMemo(() => new Set(lines.map((line) => line.candidate.product.id)), [lines]);

  const restockPageCount = Math.max(1, Math.ceil(lines.length / RESTOCK_PAGE_SIZE));
  const normalizedRestockPage = clampPage(restockPage, lines.length, RESTOCK_PAGE_SIZE);
  const pagedLines = useMemo(() => {
    const start = (normalizedRestockPage - 1) * RESTOCK_PAGE_SIZE;
    return lines.slice(start, start + RESTOCK_PAGE_SIZE);
  }, [lines, normalizedRestockPage]);

  const reviewPageCount = Math.max(1, Math.ceil(selectedLines.length / REVIEW_PAGE_SIZE));
  const normalizedReviewPage = clampPage(reviewPage, selectedLines.length, REVIEW_PAGE_SIZE);
  const pagedSelectedLines = useMemo(() => {
    const start = (normalizedReviewPage - 1) * REVIEW_PAGE_SIZE;
    return selectedLines.slice(start, start + REVIEW_PAGE_SIZE);
  }, [selectedLines, normalizedReviewPage]);

  useEffect(() => {
    if (restockPage !== normalizedRestockPage) setRestockPage(normalizedRestockPage);
  }, [normalizedRestockPage, restockPage]);

  useEffect(() => {
    if (reviewPage !== normalizedReviewPage) setReviewPage(normalizedReviewPage);
  }, [normalizedReviewPage, reviewPage]);

  function updateLine(productId: string, update: (line: PlanLine) => PlanLine) {
    setLines((current) =>
      current.map((line) => (line.candidate.product.id === productId ? update(line) : line))
    );
    if (draftOrder?.status === "DRAFT") setDraftDirty(true);
    setNotice(null);
    setError(null);
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.candidate.product.id !== productId));
    setExpandedProductIds((current) => {
      if (!current.has(productId)) return current;
      const next = new Set(current);
      next.delete(productId);
      return next;
    });
    if (draftOrder?.status === "DRAFT") setDraftDirty(true);
    setNotice(null);
    setError(null);
  }

  function toggleDetails(productId: string) {
    setExpandedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function searchExistingProducts(targetPage = 1) {
    const normalized = searchTerm.trim();
    if (normalized.length < 2) {
      setCatalogError("Enter at least two characters to search existing products.");
      return;
    }

    setSearching(true);
    setCatalogError(null);
    try {
      const result = await listRestockPlanning({
        search: normalized,
        includeZero: true,
        page: targetPage,
        pageSize: CATALOG_PAGE_SIZE
      });
      setSearchResults(result.items);
      setCatalogMeta(result.meta);
    } catch (requestError) {
      setCatalogError(
        requestError instanceof Error
          ? requestError.message
          : "Existing products could not be searched."
      );
    } finally {
      setSearching(false);
    }
  }

  function addExistingProduct(candidate: RestockPlanningCandidate) {
    if (lineIds.has(candidate.product.id)) return;

    const manual = candidate.recommendedQuantity === 0;
    setLines((current) => [...current, makePlanLine(candidate, manual)]);
    if (draftOrder?.status === "DRAFT") setDraftDirty(true);
    setNotice(`${candidate.product.name} added to the restock list.`);
    setCatalogError(null);
    setError(null);
  }

  async function saveStockPolicy(line: PlanLine) {
    if (draftOrder) return;

    setBusyAction(`policy:${line.candidate.product.id}`);
    setError(null);
    setNotice(null);

    try {
      const response = await updateProduct(line.candidate.product.id, {
        reorderLevel: line.policyReorderLevel,
        targetStockLevel: line.policyTargetStockLevel
      });
      if (!response.success) throw new Error(response.message);

      const refreshed = await listRestockPlanning({
        search: line.candidate.product.sku,
        includeZero: true,
        page: 1,
        pageSize: 100
      });
      const candidate = refreshed.items.find(
        (item) => item.product.id === line.candidate.product.id
      );

      if (candidate) {
        setLines((current) =>
          current.map((currentLine) => {
            if (currentLine.candidate.product.id !== candidate.product.id) return currentLine;

            const ownerAlreadyCustomized =
              currentLine.requestedQuantity !== currentLine.recommendedQuantity;
            return {
              ...currentLine,
              candidate,
              isSelected: ownerAlreadyCustomized
                ? currentLine.isSelected
                : candidate.recommendedQuantity > 0,
              policyReorderLevel: candidate.product.reorderLevel,
              policyTargetStockLevel: candidate.product.targetStockLevel,
              recommendationId: candidate.recommendationId,
              recommendationSource: candidate.recommendationSource,
              recommendedQuantity: candidate.recommendedQuantity,
              requestedQuantity: ownerAlreadyCustomized
                ? currentLine.requestedQuantity
                : candidate.recommendedQuantity
            };
          })
        );
      }

      setNotice(`Stock settings updated for ${line.candidate.product.name}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Stock settings could not be updated."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function dismissRecommendation(line: PlanLine) {
    if (!line.recommendationId || draftOrder) return;
    const reason = dismissReasons[line.candidate.product.id]?.trim() ?? "";
    if (reason.length < 3) {
      setError("Add a short reason before marking this recommendation as not needed.");
      return;
    }

    setBusyAction(`dismiss:${line.candidate.product.id}`);
    setError(null);
    setNotice(null);
    try {
      await dismissRestockRecommendation(line.recommendationId, reason);
      setLines((current) =>
        current.filter((item) => item.candidate.product.id !== line.candidate.product.id)
      );
      setNotice(`${line.candidate.product.name} marked as not needed.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The restock recommendation could not be updated."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function saveForLater() {
    const validationError = validatePlan(lines);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusyAction("save-for-later");
    setError(null);
    setNotice(null);

    try {
      let order = draftOrder;

      if (!order) {
        order = await createRestockOrder({
          notes: draftNotes.trim() || null,
          lines: lines.map(toDraftLine)
        });
      } else if (order.status === "DRAFT" && draftDirty) {
        order = await replaceRestockOrderLines(order.id, {
          expectedVersion: order.version,
          lines: lines.map(toDraftLine)
        });
      }

      if (!order || order.status !== "DRAFT") return;

      setDraftOrder(order);
      setDraftDirty(false);
      setDraftNotes(order.notes ?? draftNotes);
      setReviewOpen(false);
      setNotice(`${order.orderNumber} saved for later. Inventory has not changed.`);
      onOrdersChanged();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Restock list could not be saved."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmRestock() {
    const validationError = validatePlan(lines);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (confirmLockRef.current) return;
    confirmLockRef.current = true;

    setBusyAction("confirm");
    setError(null);
    setNotice(null);
    let savedBeforeApproval = false;

    try {
      let order = draftOrder;

      if (!order) {
        order = await createRestockOrder({
          notes: draftNotes.trim() || null,
          lines: lines.map(toDraftLine)
        });
        savedBeforeApproval = true;
        setDraftOrder(order);
        setDraftDirty(false);
        setDraftNotes(order.notes ?? draftNotes);
      } else if (order.status === "DRAFT" && draftDirty) {
        order = await replaceRestockOrderLines(order.id, {
          expectedVersion: order.version,
          lines: lines.map(toDraftLine)
        });
        savedBeforeApproval = true;
        setDraftOrder(order);
        setDraftDirty(false);
      }

      if (!order || order.status !== "DRAFT") return;

      const approved = await approveRestockOrder(order.id, order.version);
      setDraftOrder(approved);
      setDraftDirty(false);
      setReviewOpen(false);
      setNotice(null);
      onOrdersChanged();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Restock order could not be confirmed.";
      setError(
        savedBeforeApproval
          ? `Your restock list was saved, but confirmation did not finish. ${message}`
          : message
      );
    } finally {
      confirmLockRef.current = false;
      setBusyAction(null);
    }
  }

  function openReview() {
    const validationError = validatePlan(lines);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setReviewPage(1);
    setReviewOpen(true);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Restock planner</CardTitle>
              <Badge variant="info">Recommended</Badge>
              {draftOrder ? (
                <Badge variant={statusVariant(draftOrder.status)}>
                  {statusLabel(draftOrder.status)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Review and prepare products for restocking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{selectedCount.toLocaleString()} products</Badge>
            <Badge>{requestedUnits.toLocaleString()} units</Badge>
            <Button
              aria-label="Refresh restock recommendations"
              disabled={loading || Boolean(draftOrder) || busyAction !== null}
              onClick={() => void loadRecommendations()}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Action needed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {notice ? (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
            <AlertTitle>Updated</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        {draftOrder?.status === "DRAFT" ? (
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">{draftOrder.orderNumber}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {draftOrder.status === "DRAFT"
                  ? draftDirty
                    ? "Changes will be saved when you review or save for later."
                    : "Your restock list is saved."
                  : "This restock has been confirmed and is waiting for the delivery workflow."}
              </p>
            </div>
            <Badge variant={statusVariant(draftOrder.status)}>
              {statusLabel(draftOrder.status)}
            </Badge>
          </div>
        ) : null}

        {draftOrder && draftOrder.status !== "DRAFT" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-600" />
                  <p className="font-semibold text-emerald-950">Restock confirmed</p>
                  <Badge variant="success">{statusLabel(draftOrder.status)}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {draftOrder.orderNumber}
                </p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  {selectedCount.toLocaleString()} product{selectedCount === 1 ? "" : "s"} ·{" "}
                  {requestedUnits.toLocaleString()} units. Physical inventory is unchanged until the
                  delivery is actually received.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busyAction !== null}
                  onClick={() => void loadRecommendations()}
                  type="button"
                  variant="secondary"
                >
                  Start new restock
                </Button>
                <Button onClick={onOpenOrders} type="button">
                  View orders
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {editable ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={busyAction !== null}
                onClick={() => {
                  setCatalogError(null);
                  setCatalogOpen(true);
                }}
                type="button"
                variant="secondary"
              >
                <PackagePlus aria-hidden="true" className="h-4 w-4" />
                Add product
              </Button>
              <p className="text-xs text-slate-500">
                Search the catalog without expanding the restock page.
              </p>
            </div>
            {lines.length > RESTOCK_PAGE_SIZE ? (
              <PaginationControls
                currentPage={normalizedRestockPage}
                label={`${lines.length.toLocaleString()} items`}
                onNext={() => setRestockPage((current) => current + 1)}
                onPrevious={() => setRestockPage((current) => current - 1)}
                totalPages={restockPageCount}
              />
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Loading restock suggestions…
          </div>
        ) : null}

        {!loading && lines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto h-8 w-8 text-emerald-600" />
            <p className="mt-3 text-sm font-semibold text-slate-950">
              No products need restocking right now.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Add a product manually if the Owner wants to place a custom restock.
            </p>
          </div>
        ) : null}

        {!loading && lines.length > 0 && editable ? (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="hidden grid-cols-[minmax(260px,1fr)_110px_130px_170px_150px] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400 lg:grid">
              <span>Product</span>
              <span>Current</span>
              <span>Suggested</span>
              <span>Order quantity</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-slate-100">
              {pagedLines.map((line) => {
                const productId = line.candidate.product.id;
                const overrideRequired = needsOverrideReason(line);
                const dismissReason = dismissReasons[productId] ?? "";
                const lineBusy = busyAction?.endsWith(productId) ?? false;
                const expanded = expandedProductIds.has(productId);

                return (
                  <article className="bg-white" key={productId}>
                    <div className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(260px,1fr)_110px_130px_170px_150px] lg:items-center">
                      <label className="flex min-w-0 items-start gap-3">
                        <input
                          aria-label={`Include ${line.candidate.product.name} in restock`}
                          checked={line.isSelected}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                          disabled={!editable}
                          onChange={(event) =>
                            updateLine(productId, (current) => ({
                              ...current,
                              isSelected: event.target.checked
                            }))
                          }
                          type="checkbox"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-950">
                              {line.candidate.product.name}
                            </span>
                            {line.recommendationSource === "MANUAL" ? (
                              <Badge>Custom</Badge>
                            ) : (
                              <Badge variant="info">Suggested</Badge>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {line.candidate.product.sku}
                            {line.candidate.product.barcode
                              ? ` • ${line.candidate.product.barcode}`
                              : ""}
                          </span>
                        </span>
                      </label>

                      <CompactValue label="Current" value={line.candidate.sellableStock} />
                      <CompactValue
                        label="Suggested"
                        value={
                          line.recommendationSource === "MANUAL"
                            ? "Custom"
                            : line.recommendedQuantity
                        }
                      />

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500 lg:hidden">
                          Order quantity
                        </label>
                        <Input
                          aria-label={`Order quantity for ${line.candidate.product.name}`}
                          disabled={!editable || !line.isSelected}
                          inputMode="numeric"
                          min={1}
                          onChange={(event) =>
                            updateLine(productId, (current) => ({
                              ...current,
                              requestedQuantity: asNonNegativeInteger(event.target.value)
                            }))
                          }
                          onFocus={(event) => event.currentTarget.select()}
                          step={1}
                          type="number"
                          value={line.requestedQuantity}
                        />
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <Button
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Hide" : "Show"} details for ${line.candidate.product.name}`}
                          onClick={() => toggleDetails(productId)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <Settings2 aria-hidden="true" className="h-4 w-4" />
                          Details
                          <ChevronDown
                            aria-hidden="true"
                            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                          />
                        </Button>
                        <Button
                          aria-label={`Remove ${line.candidate.product.name} from restock`}
                          disabled={!editable || busyAction !== null}
                          onClick={() => removeLine(productId)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {overrideRequired && line.isSelected ? (
                      <div className="border-t border-amber-100 bg-amber-50 px-3 py-3">
                        <label className="mb-1 block text-xs font-medium text-amber-900">
                          Why did you change the suggested quantity?{" "}
                          <span aria-hidden="true">*</span>
                        </label>
                        <Input
                          aria-label={`Reason for changing suggested quantity for ${line.candidate.product.name}`}
                          disabled={!editable}
                          onChange={(event) =>
                            updateLine(productId, (current) => ({
                              ...current,
                              ownerOverrideReason: event.target.value
                            }))
                          }
                          placeholder="Example: weekend demand or supplier pack size"
                          value={line.ownerOverrideReason}
                        />
                      </div>
                    ) : null}

                    {expanded ? (
                      <div className="space-y-4 border-t border-slate-200 bg-slate-50 px-3 py-4">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <Metric label="Physical" value={line.candidate.physicalOnHand} />
                          <Metric label="Quarantined" value={line.candidate.quarantinedStock} />
                          <Metric label="On the way" value={line.candidate.incomingStock} />
                          <Metric
                            label="Forecast demand"
                            value={line.candidate.forecast?.currentMonthDemand ?? "—"}
                          />
                        </div>

                        <p className="text-xs leading-5 text-slate-500">
                          {line.candidate.rationale}
                        </p>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Target stock
                            </label>
                            <Input
                              aria-label={`Target stock for ${line.candidate.product.name}`}
                              disabled={Boolean(draftOrder)}
                              min={0}
                              onChange={(event) =>
                                updateLine(productId, (current) => ({
                                  ...current,
                                  policyTargetStockLevel: asNonNegativeInteger(event.target.value)
                                }))
                              }
                              type="number"
                              value={line.policyTargetStockLevel}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Reorder level
                            </label>
                            <Input
                              aria-label={`Reorder level for ${line.candidate.product.name}`}
                              disabled={Boolean(draftOrder)}
                              min={0}
                              onChange={(event) =>
                                updateLine(productId, (current) => ({
                                  ...current,
                                  policyReorderLevel: asNonNegativeInteger(event.target.value)
                                }))
                              }
                              type="number"
                              value={line.policyReorderLevel}
                            />
                          </div>
                        </div>

                        {!draftOrder ? (
                          <div className="flex justify-end">
                            <Button
                              disabled={lineBusy || busyAction !== null}
                              onClick={() => void saveStockPolicy(line)}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              Save stock settings
                            </Button>
                          </div>
                        ) : null}

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Item note <span className="font-normal text-slate-400">(optional)</span>
                          </label>
                          <Input
                            disabled={!editable}
                            onChange={(event) =>
                              updateLine(productId, (current) => ({
                                ...current,
                                notes: event.target.value
                              }))
                            }
                            placeholder="Delivery or ordering note for this item"
                            value={line.notes}
                          />
                        </div>

                        {line.recommendationId && !draftOrder ? (
                          <div className="rounded-md border border-slate-200 bg-white p-3">
                            <p className="text-xs font-medium text-slate-700">
                              Don't need this recommendation?
                            </p>
                            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end">
                              <div className="flex-1">
                                <label className="mb-1 block text-xs text-slate-500">Reason</label>
                                <Input
                                  onChange={(event) =>
                                    setDismissReasons((current) => ({
                                      ...current,
                                      [productId]: event.target.value
                                    }))
                                  }
                                  placeholder="Example: supplier already delivered"
                                  value={dismissReason}
                                />
                              </div>
                              <Button
                                disabled={dismissReason.trim().length < 3 || busyAction !== null}
                                onClick={() => void dismissRecommendation(line)}
                                type="button"
                                variant="secondary"
                              >
                                Not needed
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {!loading && lines.length > 0 && editable ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {selectedCount.toLocaleString()} product{selectedCount === 1 ? "" : "s"} •{" "}
                {requestedUnits.toLocaleString()} units
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Showing {((normalizedRestockPage - 1) * RESTOCK_PAGE_SIZE + 1).toLocaleString()}–
                {Math.min(normalizedRestockPage * RESTOCK_PAGE_SIZE, lines.length).toLocaleString()}{" "}
                of {lines.length.toLocaleString()} products. Physical Inventory stays unchanged
                until delivery is actually received.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lines.length > RESTOCK_PAGE_SIZE ? (
                <PaginationControls
                  currentPage={normalizedRestockPage}
                  label="Restock list"
                  onNext={() => setRestockPage((current) => current + 1)}
                  onPrevious={() => setRestockPage((current) => current - 1)}
                  totalPages={restockPageCount}
                />
              ) : null}
              <Button
                disabled={!editable || selectedCount === 0 || busyAction !== null}
                onClick={openReview}
                type="button"
              >
                Review restock
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      <Dialog
        onOpenChange={(open) => {
          setCatalogOpen(open);
          if (!open) setCatalogError(null);
        }}
        open={catalogOpen}
      >
        <DialogContent className="max-w-[820px]">
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
            <DialogDescription>
              Search existing catalog products. Results stay paged so large catalogs do not stretch
              the Reports page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                autoFocus
                disabled={searching}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchExistingProducts(1);
                }}
                placeholder="Product name, SKU, or barcode"
                value={searchTerm}
              />
              <Button
                disabled={searching || busyAction !== null}
                onClick={() => void searchExistingProducts(1)}
                type="button"
                variant="secondary"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>

            {catalogError ? (
              <Alert variant="destructive">
                <AlertTitle>Search needs attention</AlertTitle>
                <AlertDescription>{catalogError}</AlertDescription>
              </Alert>
            ) : null}

            {searchResults.length > 0 ? (
              <div className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {searchResults.map((candidate) => {
                  const alreadyAdded = lineIds.has(candidate.product.id);

                  return (
                    <div
                      className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      key={candidate.product.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {candidate.product.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {candidate.product.sku} • Current stock {candidate.sellableStock}
                          {candidate.recommendedQuantity > 0
                            ? ` • Suggested ${candidate.recommendedQuantity}`
                            : ""}
                        </p>
                      </div>
                      <Button
                        disabled={alreadyAdded || busyAction !== null}
                        onClick={() => addExistingProduct(candidate)}
                        size="sm"
                        type="button"
                        variant={alreadyAdded ? "secondary" : "default"}
                      >
                        {alreadyAdded ? "Added" : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : catalogMeta ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                No matching products found.
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                Enter at least two characters to search the catalog.
              </div>
            )}

            {catalogMeta && catalogMeta.totalPages > 1 ? (
              <div className="flex justify-end">
                <PaginationControls
                  currentPage={catalogMeta.page}
                  label={`${catalogMeta.totalItems.toLocaleString()} matches`}
                  onNext={() => void searchExistingProducts(catalogMeta.page + 1)}
                  onPrevious={() => void searchExistingProducts(catalogMeta.page - 1)}
                  totalPages={catalogMeta.totalPages}
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Done
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setReviewOpen} open={reviewOpen}>
        <DialogContent className="max-h-[88vh] max-w-[760px] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Review restock</DialogTitle>
            <DialogDescription>
              Check the products and quantities before you save or confirm the restock.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryValue label="Products" value={selectedCount} />
              <SummaryValue label="Total units" value={requestedUnits} />
              <SummaryValue label="Quantity changes" value={overrideCount} />
            </div>

            <div className="max-h-[36vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {pagedSelectedLines.map((line) => (
                <div
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between"
                  key={line.candidate.product.id}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-950">{line.candidate.product.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Current {line.candidate.sellableStock}
                      {line.recommendationSource === "MANUAL"
                        ? " • Custom restock"
                        : ` • Suggested ${line.recommendedQuantity}`}
                    </p>
                    {needsOverrideReason(line) ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Changed quantity: {line.ownerOverrideReason}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold text-slate-950">
                    {line.requestedQuantity.toLocaleString()} units
                  </p>
                </div>
              ))}
            </div>

            {selectedLines.length > REVIEW_PAGE_SIZE ? (
              <div className="flex justify-end">
                <PaginationControls
                  currentPage={normalizedReviewPage}
                  label={`${selectedLines.length.toLocaleString()} selected`}
                  onNext={() => setReviewPage((current) => current + 1)}
                  onPrevious={() => setReviewPage((current) => current - 1)}
                  totalPages={reviewPageCount}
                />
              </div>
            ) : null}

            {!draftOrder ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Restock note <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Textarea
                  onChange={(event) => setDraftNotes(event.target.value)}
                  placeholder="General note for this restock order"
                  value={draftNotes}
                />
              </div>
            ) : draftOrder.notes ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Restock note</p>
                <p className="mt-1 text-sm text-slate-700">{draftOrder.notes}</p>
              </div>
            ) : null}

            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTitle>Physical stock will not change yet</AlertTitle>
              <AlertDescription>
                Confirming creates the approved incoming quantity only. Inventory increases later,
                when the actual delivery is received.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={busyAction !== null} type="button" variant="secondary">
                Back
              </Button>
            </DialogClose>
            <Button
              disabled={busyAction !== null}
              onClick={() => void saveForLater()}
              type="button"
              variant="secondary"
            >
              {busyAction === "save-for-later" ? "Saving…" : "Save for later"}
            </Button>
            <Button
              disabled={busyAction !== null}
              onClick={() => void confirmRestock()}
              type="button"
            >
              {busyAction === "confirm" ? "Confirming…" : "Confirm restock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CompactValue({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3 lg:block">
      <span className="text-xs font-medium text-slate-500 lg:hidden">{label}</span>
      <span className="text-sm font-semibold text-slate-950">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

function PaginationControls({
  currentPage,
  label,
  onNext,
  onPrevious,
  totalPages
}: {
  currentPage: number;
  label: string;
  onNext: () => void;
  onPrevious: () => void;
  totalPages: number;
}) {
  return (
    <div className="flex items-center gap-1 text-xs text-slate-500">
      <span className="mr-1 hidden sm:inline">{label}</span>
      <Button
        aria-label={`Previous page of ${label}`}
        disabled={currentPage <= 1}
        onClick={onPrevious}
        size="sm"
        type="button"
        variant="ghost"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      </Button>
      <span className="min-w-[78px] text-center tabular-nums">
        Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
      </span>
      <Button
        aria-label={`Next page of ${label}`}
        disabled={currentPage >= totalPages}
        onClick={onNext}
        size="sm"
        type="button"
        variant="ghost"
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
