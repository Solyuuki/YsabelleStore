import { readFileSync, writeFileSync } from "node:fs";

const reportsPath = "frontend/src/pages/ReportsPage.tsx";
const planningPath = "frontend/src/components/reports/RestockPlanningPanel.tsx";
const testPath = "scripts/restock-phase7-9-ui-contract-test.ts";

let reports = readFileSync(reportsPath, "utf8");
let planning = readFileSync(planningPath, "utf8");
let test = readFileSync(testPath, "utf8");

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Patch target not found: ${label}`);
  }
  return source.replace(before, after);
}

reports = replaceOnce(
  reports,
  `            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Restock forecast</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Automatic SARIMAX-driven recommendations are shown below before projected
                  stockouts. Manual custom restocking stays in the separate Restock planner.
                </p>
              </div>
              <Button
                aria-controls="restock-drafts"
                aria-pressed={draftsOpen}
                onClick={toggleRestockDrafts}
                size="sm"
                type="button"
                variant={draftsOpen ? "default" : "secondary"}
              >
                Saved drafts
              </Button>
            </div>`,
  `            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <h2 className="text-base font-semibold text-slate-950">Restock forecast</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Automatic SARIMAX-driven recommendations are shown below before projected
                stockouts. Manual custom restocking stays in the separate Restock planner.
              </p>
            </div>`,
  "forecast header"
);

reports = replaceOnce(
  reports,
  `            {draftsOpen ? (
              <div className="scroll-mt-4" id="restock-drafts" ref={restockDraftsRef}>
                <RestockDraftsPanel
                  onDraftConfirmed={notifyRestockOrdersChanged}
                  refreshVersion={refreshVersion + restockOrdersRefreshVersion}
                />
              </div>
            ) : null}

            <RestockPlanningPanel
              onOpenOrders={openRestockDrafts}
              onOrdersChanged={notifyRestockOrdersChanged}
            />`,
  `            <RestockPlanningPanel
              onOpenOrders={toggleRestockDrafts}
              onOrdersChanged={notifyRestockOrdersChanged}
            />

            {draftsOpen ? (
              <div className="scroll-mt-4" id="restock-drafts" ref={restockDraftsRef}>
                <RestockDraftsPanel
                  onDraftConfirmed={notifyRestockOrdersChanged}
                  refreshVersion={refreshVersion + restockOrdersRefreshVersion}
                />
              </div>
            ) : null}`,
  "planner/drafts order"
);

planning = planning.replace("  RefreshCw,\n", "");
planning = planning.replace(
  "  const [loading, setLoading] = useState(true);",
  "  const [loading, setLoading] = useState(false);"
);

const loadBlock = /  const loadRecommendations = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[\]\);\n\n  useEffect\(\(\) => \{\n    void loadRecommendations\(\);\n  \}, \[loadRecommendations\]\);/;
if (!loadBlock.test(planning)) throw new Error("Patch target not found: planner loader");
planning = planning.replace(
  loadBlock,
  `  const resetPlanner = useCallback(() => {
    setLines([]);
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
    setError(null);
    setNotice(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    resetPlanner();
  }, [resetPlanner]);`
);
planning = planning.replaceAll("loadRecommendations", "resetPlanner");

planning = replaceOnce(
  planning,
  `    const manual = candidate.recommendedQuantity === 0;
    setLines((current) => [...current, makePlanLine(candidate, manual)]);`,
  `    setLines((current) => [...current, makePlanLine(candidate, true)]);`,
  "manual add"
);

planning = planning.replace(
  '<Badge variant="info">Recommended</Badge>',
  '<Badge>Manual</Badge>'
);
planning = planning.replace(
  "              Review and prepare products for restocking.",
  "              Create a custom restock by adding products and setting order quantities."
);

planning = replaceOnce(
  planning,
  `            <Badge>{selectedCount.toLocaleString()} products</Badge>
            <Badge>{requestedUnits.toLocaleString()} units</Badge>
            <Button
              aria-label="Refresh restock recommendations"
              disabled={loading || Boolean(draftOrder) || busyAction !== null}
              onClick={() => void resetPlanner()}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Refresh
            </Button>`,
  `            <Badge>{selectedCount.toLocaleString()} products</Badge>
            <Badge>{requestedUnits.toLocaleString()} units</Badge>
            <Button
              aria-controls="restock-drafts"
              onClick={onOpenOrders}
              size="sm"
              type="button"
              variant="secondary"
            >
              Saved drafts
            </Button>`,
  "planner header actions"
);

planning = planning.replace(
  "              No products need restocking right now.",
  "              No products in this custom restock yet."
);
planning = planning.replace(
  "              Add a product manually if the Owner wants to place a custom restock.",
  "              Add a product manually to start a custom restock."
);

planning = replaceOnce(
  planning,
  `              <Button
                disabled={!editable || selectedCount === 0 || busyAction !== null}
                onClick={openReview}
                type="button"
              >
                Review restock
              </Button>`,
  `              <Button
                disabled={
                  !editable ||
                  selectedCount === 0 ||
                  busyAction !== null ||
                  Boolean(draftOrder?.status === "DRAFT" && !draftDirty)
                }
                onClick={() => void saveForLater()}
                type="button"
                variant="secondary"
              >
                {busyAction === "save-for-later"
                  ? "Saving…"
                  : draftOrder?.status === "DRAFT"
                    ? draftDirty
                      ? "Save changes"
                      : "Saved for later"
                    : "Save for later"}
              </Button>
              <Button
                disabled={!editable || selectedCount === 0 || busyAction !== null}
                onClick={openReview}
                type="button"
              >
                Review restock
              </Button>`,
  "planner footer actions"
);

planning = replaceOnce(
  planning,
  `            <Button
              disabled={busyAction !== null}
              onClick={() => void saveForLater()}
              type="button"
              variant="secondary"
            >
              {busyAction === "save-for-later" ? "Saving…" : "Save for later"}
            </Button>
`,
  "",
  "review modal save action"
);

if (!test.includes("const planningSource")) {
  test = test.replace(
    'const reportsSource = readFileSync(resolve(process.cwd(), "src/pages/ReportsPage.tsx"), "utf8");',
    'const reportsSource = readFileSync(resolve(process.cwd(), "src/pages/ReportsPage.tsx"), "utf8");\nconst planningSource = readFileSync(\n  resolve(process.cwd(), "src/components/reports/RestockPlanningPanel.tsx"),\n  "utf8"\n);'
  );
}
test = test.replace(
  "assert.match(reportsSource, /Saved drafts/);",
  "assert.doesNotMatch(reportsSource, />Saved drafts</);"
);
const marker = "assert.match(reportsSource, /RestockDraftsPanel/);";
const additions = `assert.match(planningSource, /<Badge>Manual<\\/Badge>/);
assert.match(planningSource, /Save for later/);
assert.match(planningSource, />Saved drafts</);
assert.match(planningSource, /makePlanLine\\(candidate, true\\)/);
assert.doesNotMatch(planningSource, /<Badge variant="info">Recommended<\\/Badge>/);`;
if (!test.includes(additions)) test = test.replace(marker, `${marker}\n${additions}`);

writeFileSync(reportsPath, reports);
writeFileSync(planningPath, planning);
writeFileSync(testPath, test);
