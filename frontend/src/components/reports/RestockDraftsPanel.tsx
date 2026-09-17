import { CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
import {
  approveRestockOrder,
  listRestockOrders,
  type RestockOrder,
  type RestockOrderLine
} from "@/services/restockApi";

function selectedLines(order: RestockOrder) {
  return order.lines.filter((line) => line.isSelected && line.requestedQuantity > 0);
}

function unitCount(lines: RestockOrderLine[]) {
  return lines.reduce((sum, line) => sum + line.requestedQuantity, 0);
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

  async function confirmDraft() {
    if (!selectedDraft || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const approved = await approveRestockOrder(selectedDraft.id, selectedDraft.version);
      setSelectedDraft(null);
      pushToast({
        title: "Restock sent to Receiving",
        message: `${approved.orderNumber} is now available in Receiving for the physical delivery.`,
        variant: "success"
      });
      onDraftConfirmed();
      await loadDrafts();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The restock draft could not be confirmed."
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Saved restock drafts</CardTitle>
                <Badge>{total.toLocaleString()} saved</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Drafts stay in Reports. Once confirmed, the restock ticket moves to Receiving.
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
            {drafts.map((draft) => {
              const lines = selectedLines(draft);
              const units = unitCount(lines);
              return (
                <article
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={draft.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {draft.orderNumber}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {lines.length.toLocaleString()} product{lines.length === 1 ? "" : "s"} ·{" "}
                      {units.toLocaleString()} units
                    </p>
                  </div>
                  <Button
                    onClick={() => setSelectedDraft(draft)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Review draft
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
          if (!open && !confirming) setSelectedDraft(null);
        }}
      >
        <DialogContent className="max-w-[760px]">
          {selectedDraft ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDraft.orderNumber}</DialogTitle>
                <DialogDescription>
                  Confirming this draft creates the incoming restock ticket. Physical stock still
                  does not change until Receiving.
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto px-6 pb-2">
                {selectedLines(selectedDraft).map((line) => (
                  <div className="flex items-center justify-between gap-4 py-3" key={line.id}>
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

              <DialogFooter>
                <Button
                  disabled={confirming}
                  onClick={() => setSelectedDraft(null)}
                  type="button"
                  variant="secondary"
                >
                  Keep draft
                </Button>
                <Button disabled={confirming} onClick={() => void confirmDraft()} type="button">
                  {confirming ? (
                    <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : null}
                  {confirming ? "Confirming…" : "Confirm & send to Receiving"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
