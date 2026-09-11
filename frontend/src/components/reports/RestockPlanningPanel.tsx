import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    line.recommendationSource !== "MANUAL" &&
    line.requestedQuantity !== line.recommendedQuantity
  );
}

function validatePlan(lines: PlanLine[]) {
  if (lines.length === 0) return "Add at least one product to the restock plan.";

  const selected = lines.filter((line) => line.isSelected);
  if (selected.length === 0) return "Select at least one line before creating or approving a restock.";
  if (selected.some((line) => line.requestedQuantity < 1)) {
    return "Selected restock lines require a requested quantity greater than zero.";
  }

  const missingReason = lines.find(
    (line) => needsOverrideReason(line) && line.ownerOverrideReason.trim().length === 0
  );
  if (missingReason) {
    return `Explain the quantity override for ${missingReason.candidate.product.name}.`;
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

export function RestockPlanningPanel() {
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

  const selectedCount = useMemo(
    () => lines.filter((line) => line.isSelected).length,
    [lines]
  );
  const requestedUnits = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + (line.isSelected ? Math.max(0, line.requestedQuantity) : 0),
        0
      ),
    [lines]
  );
  const editable = !draftOrder || draftOrder.status === "DRAFT";

  function updateLine(productId: string, update: (line: PlanLine) => PlanLine) {
    setLines((current) =>
      current.map((line) => (line.candidate.product.id === productId ? update(line) : line))
    );
    if (draftOrder?.status === "DRAFT") setDraftDirty(true);
    setNotice(null);
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.candidate.product.id !== productId));
    if (draftOrder?.status === "DRAFT") setDraftDirty(true);
    setNotice(null);
  }

  async function searchExistingProducts() {
    const normalized = searchTerm.trim();
    if (normalized.length < 2) {
      setError("Enter at least two characters to search existing products.");
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const result = await listRestockPlanning({
        search: normalized,
        includeZero: true,
        page: 1,
        pageSize: 50
      });
      const existingIds = new Set(lines.map((line) => line.candidate.product.id));
      setSearchResults(result.items.filter((candidate) => !existingIds.has(candidate.product.id)));
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Existing products could not be searched."
      );
    } finally {
      setSearching(false);
    }
  }

  function addExistingProduct(candidate: RestockPlanningCandidate) {
    const manual = candidate.recommendedQuantity === 0;
    setLines((current) => [...current, makePlanLine(candidate, manual)]);
    setSearchResults((current) =>
      current.filter((item) => item.product.id !== candidate.product.id)
    );
    if (draftOrder?.status === "DRAFT") setDraftDirty(true);
    setNotice(`${candidate.product.name} added to the current restock plan.`);
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

      setNotice(`Stock policy updated for ${line.candidate.product.name}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Stock policy could not be updated."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function dismissRecommendation(line: PlanLine) {
    if (!line.recommendationId || draftOrder) return;
    const reason = dismissReasons[line.candidate.product.id]?.trim() ?? "";
    if (reason.length < 3) {
      setError("A dismissal reason of at least three characters is required.");
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
      setNotice(`${line.candidate.product.name} recommendation dismissed with an audit reason.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The restock recommendation could not be dismissed."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function createDraft() {
    const validationError = validatePlan(lines);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusyAction("create");
    setError(null);
    setNotice(null);
    try {
      const order = await createRestockOrder({
        notes: draftNotes.trim() || null,
        lines: lines.map(toDraftLine)
      });
      setDraftOrder(order);
      setDraftDirty(false);
      setNotice(`Draft ${order.orderNumber} created. Inventory has not changed.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Restock draft could not be created.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveDraftChanges() {
    if (!draftOrder || draftOrder.status !== "DRAFT") return;
    const validationError = validatePlan(lines);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusyAction("save");
    setError(null);
    setNotice(null);
    try {
      const order = await replaceRestockOrderLines(draftOrder.id, {
        expectedVersion: draftOrder.version,
        lines: lines.map(toDraftLine)
      });
      setDraftOrder(order);
      setDraftDirty(false);
      setNotice(`Draft ${order.orderNumber} saved at version ${order.version}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Restock draft could not be saved.");
    } finally {
      setBusyAction(null);
    }
  }

  async function approveSelectedLines() {
    if (!draftOrder || draftOrder.status !== "DRAFT") return;
    if (draftDirty) {
      setError("Save draft changes before approval so the approved lines match the current screen.");
      return;
    }
    const validationError = validatePlan(lines);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusyAction("approve");
    setError(null);
    setNotice(null);
    try {
      const order = await approveRestockOrder(draftOrder.id, draftOrder.version);
      setDraftOrder(order);
      setDraftDirty(false);
      setNotice(
        `${order.orderNumber} approved. ${selectedCount} selected line${selectedCount === 1 ? "" : "s"} now count as incoming stock; physical Inventory is unchanged.`
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Restock order could not be approved.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Recommended restock</CardTitle>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Review forecast and stock signals, customize quantities, then create an Owner-approved
              restock order. This planning workflow never creates physical stock.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{selectedCount} selected</Badge>
            <Badge>{requestedUnits.toLocaleString()} requested units</Badge>
            <Button
              disabled={loading || Boolean(draftOrder) || busyAction !== null}
              onClick={() => void loadRecommendations()}
              size="sm"
              type="button"
              variant="secondary"
            >
              Refresh recommendations
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        {draftOrder ? (
          <div className="flex flex-col gap-2 rounded-md border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">{draftOrder.orderNumber}</p>
              <p className="text-xs text-slate-600">
                Version {draftOrder.version}
                {draftDirty ? " • unsaved line changes" : " • saved"}
              </p>
            </div>
            <Badge variant={statusVariant(draftOrder.status)}>{draftOrder.status}</Badge>
          </div>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                Add existing product
              </label>
              <Input
                disabled={!editable || searching}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchExistingProducts();
                }}
                placeholder="Search by product name, SKU, or barcode"
                value={searchTerm}
              />
            </div>
            <Button
              disabled={!editable || searching || busyAction !== null}
              onClick={() => void searchExistingProducts()}
              type="button"
              variant="secondary"
            >
              {searching ? "Searching…" : "Search catalog"}
            </Button>
          </div>

          {searchResults.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {searchResults.slice(0, 8).map((candidate) => (
                <div
                  className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  key={candidate.product.id}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{candidate.product.name}</p>
                    <p className="text-xs text-slate-500">
                      {candidate.product.sku} • sellable {candidate.sellableStock} • suggested {candidate.recommendedQuantity}
                    </p>
                  </div>
                  <Button
                    disabled={!editable || busyAction !== null}
                    onClick={() => addExistingProduct(candidate)}
                    size="sm"
                    type="button"
                  >
                    Add existing product
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-slate-500">
            New Product creation is intentionally reserved for Phase 7; this Phase 6 control only
            adds products that already exist in the canonical catalog.
          </p>
        </section>

        {loading ? (
          <div className="rounded-md border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Loading restock planning data…
          </div>
        ) : null}

        {!loading && lines.length === 0 ? (
          <div className="rounded-md border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No products currently require restocking. Use catalog search above to add an existing
            product manually.
          </div>
        ) : null}

        <div className="space-y-3">
          {lines.map((line) => {
            const productId = line.candidate.product.id;
            const overrideRequired = needsOverrideReason(line);
            const dismissReason = dismissReasons[productId] ?? "";
            const lineBusy = busyAction?.endsWith(productId) ?? false;

            return (
              <article className="rounded-md border border-slate-200 p-4" key={productId}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      aria-label={`Select ${line.candidate.product.name} for restock`}
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
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{line.candidate.product.name}</p>
                        <Badge>{line.recommendationSource}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {line.candidate.product.sku}
                        {line.candidate.product.barcode
                          ? ` • ${line.candidate.product.barcode}`
                          : " • no manufacturer barcode"}
                      </p>
                    </div>
                  </div>
                  <Button
                    disabled={!editable || busyAction !== null}
                    onClick={() => removeLine(productId)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Remove item
                  </Button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  <Metric label="Sellable" value={line.candidate.sellableStock} />
                  <Metric label="Physical" value={line.candidate.physicalOnHand} />
                  <Metric label="Quarantined" value={line.candidate.quarantinedStock} />
                  <Metric label="Incoming" value={line.candidate.incomingStock} />
                  <Metric label="Suggested" value={line.recommendedQuantity} />
                  <Metric
                    label="Forecast demand"
                    value={line.candidate.forecast?.currentMonthDemand ?? "—"}
                  />
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-500">{line.candidate.rationale}</p>

                <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Requested quantity</label>
                    <Input
                      aria-label={`Requested quantity for ${line.candidate.product.name}`}
                      disabled={!editable}
                      min={0}
                      onChange={(event) =>
                        updateLine(productId, (current) => ({
                          ...current,
                          requestedQuantity: asNonNegativeInteger(event.target.value)
                        }))
                      }
                      type="number"
                      value={line.requestedQuantity}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Owner override reason {overrideRequired ? "(required)" : ""}
                    </label>
                    <Input
                      aria-label={`Owner override reason for ${line.candidate.product.name}`}
                      disabled={!editable}
                      onChange={(event) =>
                        updateLine(productId, (current) => ({
                          ...current,
                          ownerOverrideReason: event.target.value
                        }))
                      }
                      placeholder={overrideRequired ? "Why is the quantity different?" : "Optional"}
                      value={line.ownerOverrideReason}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Target stock</label>
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
                    <label className="mb-1 block text-xs font-medium text-slate-600">Reorder level</label>
                    <div className="flex gap-2">
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
                      <Button
                        disabled={Boolean(draftOrder) || lineBusy || busyAction !== null}
                        onClick={() => void saveStockPolicy(line)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Save policy
                      </Button>
                    </div>
                  </div>
                </div>

                {line.recommendationId ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 md:flex-row md:items-end">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Dismiss recommendation reason
                      </label>
                      <Input
                        disabled={Boolean(draftOrder)}
                        onChange={(event) =>
                          setDismissReasons((current) => ({
                            ...current,
                            [productId]: event.target.value
                          }))
                        }
                        placeholder="Required for audited dismissal"
                        value={dismissReason}
                      />
                    </div>
                    <Button
                      disabled={Boolean(draftOrder) || dismissReason.trim().length < 3 || busyAction !== null}
                      onClick={() => void dismissRecommendation(line)}
                      type="button"
                      variant="secondary"
                    >
                      Dismiss recommendation
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Restock notes</label>
            <Textarea
              disabled={!editable}
              onChange={(event) => {
                setDraftNotes(event.target.value);
                if (draftOrder?.status === "DRAFT") setDraftDirty(true);
              }}
              placeholder="Optional owner notes for this restock order"
              value={draftNotes}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2 lg:justify-end">
            {!draftOrder ? (
              <Button
                disabled={loading || busyAction !== null || lines.length === 0}
                onClick={() => void createDraft()}
                type="button"
              >
                {busyAction === "create" ? "Creating…" : "Create draft"}
              </Button>
            ) : null}
            {draftOrder?.status === "DRAFT" ? (
              <>
                <Button
                  disabled={!draftDirty || busyAction !== null || lines.length === 0}
                  onClick={() => void saveDraftChanges()}
                  type="button"
                  variant="secondary"
                >
                  {busyAction === "save" ? "Saving…" : "Save draft changes"}
                </Button>
                <Button
                  disabled={draftDirty || busyAction !== null || selectedCount === 0}
                  onClick={() => void approveSelectedLines()}
                  type="button"
                >
                  {busyAction === "approve" ? "Approving…" : "Approve selected lines"}
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          Restock approval creates procurement intent and canonical incoming stock only. Physical
          Inventory, batches, and stock movements remain unchanged until goods actually arrive in a
          later receiving phase.
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
