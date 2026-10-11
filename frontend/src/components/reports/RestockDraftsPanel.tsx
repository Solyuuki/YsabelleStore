import { CheckCircle2, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/shared/ToastProvider";
import { RestockOwnerWarnings } from "@/components/reports/RestockOwnerWarnings";
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
import {
  approveRestockOrder,
  listRestockOrders,
  replaceRestockOrderLines,
  removeRestockDraft,
  RestockOwnerWarningError,
  type RestockOwnerWarning,
  type RestockOrder,
  type RestockOrderLine
} from "@/services/restockApi";

function selectedLines(order: RestockOrder) {
  return order.lines.filter((line) => line.isSelected && line.requestedQuantity > 0);
}

function unitCount(lines: RestockOrderLine[]) {
  return lines.reduce((sum, line) => sum + line.requestedQuantity, 0);
}

function isRecommendedPlan(order: RestockOrder) {
  return (
    order.notes?.includes("[AutomatedRestockMonth:") === true ||
    order.notes?.includes("[AutomatedRestock:") === true ||
    /^RO-[A-Z]{3}-\d{4}$/.test(order.orderNumber)
  );
}

export function RestockDraftsPanel({
  refreshVersion = 0,
  onDraftConfirmed
}: {
  refreshVersion?: number;
  onDraftConfirmed: () => void;
}) {
  const { pushToast } = useToast();
  const [drafts, setDrafts] = useState<RestockOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<RestockOrder | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removePromptOpen, setRemovePromptOpen] = useState(false);
  const [ownerWarnings, setOwnerWarnings] = useState<RestockOwnerWarning[]>([]);
  const draftScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDraft && ownerWarnings.length > 0 && draftScrollRef.current) {
      draftScrollRef.current.scrollTop = draftScrollRef.current.scrollHeight;
    }
  }, [selectedDraft, ownerWarnings]);

  useEffect(() => {
    if (selectedDraft && removePromptOpen && draftScrollRef.current) {
      draftScrollRef.current.scrollTop = draftScrollRef.current.scrollHeight;
    }
  }, [selectedDraft, removePromptOpen]);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listRestockOrders({ page: 1, pageSize: 100, status: "DRAFT" });
      setDrafts(result.items);
      setTotal(result.meta.totalItems);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Saved restock drafts could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshVersion;
    void loadDrafts();
  }, [loadDrafts, refreshVersion]);

  async function applySuggestedQuantity(productId: string, quantity: number) {
    if (!selectedDraft || confirming || removing || !Number.isSafeInteger(quantity) || quantity < 1)
      return;
    setConfirming(true);
    setError(null);
    try {
      const updated = await replaceRestockOrderLines(selectedDraft.id, {
        expectedVersion: selectedDraft.version,
        lines: selectedDraft.lines.map((line) => ({
          productId: line.productId,
          recommendationId: line.recommendationId,
          recommendationSource: line.recommendationSource,
          recommendedQuantity: line.recommendedQuantity,
          requestedQuantity: line.productId === productId ? quantity : line.requestedQuantity,
          isSelected: line.isSelected,
          ownerOverrideReason:
            line.productId === productId &&
            line.recommendationSource !== "MANUAL" &&
            quantity !== line.recommendedQuantity
              ? "Owner selected system suggested quantity."
              : line.ownerOverrideReason,
          notes: line.notes
        }))
      });
      setSelectedDraft(updated);
      setOwnerWarnings([]);
      await loadDrafts();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not apply suggested quantity."
      );
    } finally {
      setConfirming(false);
    }
  }

  async function confirmDraft(acknowledgeWarnings = false) {
    if (!selectedDraft || confirming || removing || removePromptOpen) return;
    setConfirming(true);
    setError(null);
    try {
      const approved = await approveRestockOrder(
        selectedDraft.id,
        selectedDraft.version,
        acknowledgeWarnings
      );
      setSelectedDraft(null);
      pushToast({
        title: "Restock sent to Receiving",
        message: `${approved.orderNumber} is now available in Receiving for the physical delivery.`,
        variant: "success"
      });
      onDraftConfirmed();
      await loadDrafts();
    } catch (requestError) {
      if (requestError instanceof RestockOwnerWarningError) {
        setOwnerWarnings(requestError.warnings);
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The restock draft could not be confirmed."
      );
    } finally {
      setConfirming(false);
    }
  }

  async function confirmRemoveDraft() {
    if (!selectedDraft || removing || confirming || !removePromptOpen) return;
    if (selectedDraft.status !== "DRAFT" || isRecommendedPlan(selectedDraft)) return;

    setRemoving(true);
    setError(null);
    try {
      const orderNumber = selectedDraft.orderNumber;
      await removeRestockDraft(selectedDraft.id, selectedDraft.version);
      setSelectedDraft(null);
      setRemovePromptOpen(false);
      setOwnerWarnings([]);
      pushToast({
        title: "Draft removed",
        message: `${orderNumber} was permanently removed from saved drafts.`,
        variant: "success"
      });
      onDraftConfirmed();
      await loadDrafts();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not remove the saved draft."
      );
      setRemovePromptOpen(false);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Recommended & saved restock plans</CardTitle>
                <Badge>{total.toLocaleString()} saved</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Forecast-driven plans wait here for one owner approval. Manual drafts remain
                available for later review.
              </p>
            </div>
            <Button
              disabled={loading}
              onClick={() => void loadDrafts()}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Drafts need attention</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading && drafts.length === 0 ? (
            <div className="rounded-lg border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              Loading saved drafts…
            </div>
          ) : null}

          {!loading && drafts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
              <CheckCircle2 aria-hidden="true" className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="mt-3 text-sm font-semibold text-slate-950">No saved drafts.</p>
              <p className="mt-1 text-sm text-slate-500">
                Use Restock Planner and choose Save for later when you want to continue a plan
                another time.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            {[...drafts]
              .sort(
                (left, right) => Number(isRecommendedPlan(right)) - Number(isRecommendedPlan(left))
              )
              .map((draft) => {
                const lines = selectedLines(draft);
                const units = unitCount(lines);
                const recommendedPlan = isRecommendedPlan(draft);
                return (
                  <article
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={draft.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {draft.orderNumber}
                        </p>
                        {recommendedPlan ? (
                          <Badge variant="info">Recommended inventory plan</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {lines.length.toLocaleString()} product{lines.length === 1 ? "" : "s"} ·{" "}
                        {units.toLocaleString()} units
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setOwnerWarnings([]);
                        setRemovePromptOpen(false);
                        setSelectedDraft(draft);
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {recommendedPlan ? "Review recommended plan" : "Review draft"}
                    </Button>
                  </article>
                );
              })}
          </div>

          {total > drafts.length ? (
            <p className="text-xs text-slate-500">
              Showing the latest {drafts.length.toLocaleString()} of {total.toLocaleString()} saved
              drafts.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedDraft)}
        onOpenChange={(open) => {
          if (!open && !confirming && !removing) {
            setSelectedDraft(null);
            setOwnerWarnings([]);
            setRemovePromptOpen(false);
          }
        }}
      >
        <DialogContent className="ys-report-modal flex max-h-[calc(100dvh-2rem)] max-w-[760px] flex-col gap-0 overflow-hidden sm:max-h-[88dvh]">
          {selectedDraft ? (
            <>
              <DialogHeader className="shrink-0 pb-4">
                <DialogTitle>{selectedDraft.orderNumber}</DialogTitle>
                <DialogDescription>
                  {isRecommendedPlan(selectedDraft)
                    ? "Approve the complete forecast-driven plan once. It then moves to Receiving; physical stock does not change until delivery is accepted."
                    : "Confirming this draft creates the incoming restock ticket. Physical stock still does not change until Receiving."}
                </DialogDescription>
              </DialogHeader>

              <div
                aria-label="Saved restock items and purchasing advice"
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4 sm:px-6"
                ref={draftScrollRef}
                role="region"
                tabIndex={0}
              >
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {selectedLines(selectedDraft).map((line) => (
                    <div
                      className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
                      key={line.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-950">
                          {line.product.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{line.product.sku}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-950">
                        {line.requestedQuantity.toLocaleString()} units
                      </span>
                    </div>
                  ))}
                </div>

                <RestockOwnerWarnings
                  warnings={ownerWarnings}
                  onApplySuggestedQuantity={(productId, quantity) =>
                    void applySuggestedQuantity(productId, quantity)
                  }
                />
                {removePromptOpen ? (
                  <div
                    className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900 dark:border-red-400/60 dark:bg-red-950/35 dark:text-red-100"
                    role="alert"
                  >
                    <p className="text-sm font-semibold">Remove this saved draft?</p>
                    <p className="mt-1 text-xs leading-5">
                      This permanently deletes {selectedDraft.orderNumber} and its draft product
                      lines. It cannot be undone. No Receiving ticket or physical stock is changed.
                    </p>
                  </div>
                ) : null}

                {error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Draft needs attention</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <DialogFooter className="shrink-0 flex-wrap gap-2">
                {removePromptOpen ? (
                  <>
                    <Button
                      disabled={removing}
                      onClick={() => setRemovePromptOpen(false)}
                      type="button"
                      variant="secondary"
                    >
                      Back to draft
                    </Button>
                    <Button
                      disabled={removing}
                      onClick={() => void confirmRemoveDraft()}
                      type="button"
                      variant="danger"
                    >
                      {removing ? (
                        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      )}
                      {removing ? "Removing…" : "Yes, remove draft"}
                    </Button>
                  </>
                ) : (
                  <>
                    {selectedDraft.status === "DRAFT" && !isRecommendedPlan(selectedDraft) ? (
                      <Button
                        className="sm:mr-auto"
                        disabled={confirming || removing}
                        onClick={() => {
                          setError(null);
                          setRemovePromptOpen(true);
                          draftScrollRef.current?.scrollTo({
                            top: draftScrollRef.current.scrollHeight,
                            behavior: "smooth"
                          });
                        }}
                        type="button"
                        variant="danger"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        Remove draft
                      </Button>
                    ) : null}
                    <Button
                      disabled={confirming || removing}
                      onClick={() => {
                        setSelectedDraft(null);
                        setOwnerWarnings([]);
                        setRemovePromptOpen(false);
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Keep draft
                    </Button>
                    <Button
                      disabled={confirming || removing}
                      onClick={() => void confirmDraft(ownerWarnings.length > 0)}
                      type="button"
                    >
                      {confirming ? (
                        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                      ) : null}
                      {confirming
                        ? "Confirming…"
                        : ownerWarnings.length > 0
                          ? "Continue with my quantities"
                          : isRecommendedPlan(selectedDraft)
                            ? "Approve Recommended Plan"
                            : "Confirm & send to Receiving"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
