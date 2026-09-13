import { readFileSync, writeFileSync } from "node:fs";

const path = "frontend/src/components/reports/RestockForecastPanel.tsx";
let source = readFileSync(path, "utf8");

const loadingImport = `import { LoadingState } from "@/components/shared/LoadingState";`;
const demoImport = `import {
  createRestockForecastDemo,
  RESTOCK_FORECAST_DEMO_PRODUCT_ID
} from "@/components/reports/restockForecastDemo";`;
if (!source.includes(demoImport)) {
  source = source.replace(loadingImport, `${demoImport}\n${loadingImport}`);
}

const stateBlock = `  const [items, setItems] = useState<RestockPlanningCandidate[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);`;
const stateReplacement = `  const [items, setItems] = useState<RestockPlanningCandidate[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);`;
if (!source.includes("const [demoMode, setDemoMode]")) {
  if (!source.includes(stateBlock)) throw new Error("forecast state block not found");
  source = source.replace(stateBlock, stateReplacement);
}

const selectedBlock = `  const selected = useMemo(
    () => items.find((item) => item.product.id === selectedProductId) ?? null,
    [items, selectedProductId]
  );
  const actionableItems = useMemo(
    () => items.filter((item) => item.recommendedQuantity > 0),
    [items]
  );`;
const selectedReplacement = `  const displayItems = useMemo(
    () => (demoMode ? [createRestockForecastDemo()] : items),
    [demoMode, items]
  );
  const selected = useMemo(
    () => displayItems.find((item) => item.product.id === selectedProductId) ?? null,
    [displayItems, selectedProductId]
  );
  const actionableItems = useMemo(
    () => displayItems.filter((item) => item.recommendedQuantity > 0),
    [displayItems]
  );`;
if (!source.includes("const displayItems = useMemo")) {
  if (!source.includes(selectedBlock)) throw new Error("selected block not found");
  source = source.replace(selectedBlock, selectedReplacement);
}

const summaryEnd = `  }, [actionableItems]);

  if (loading && items.length === 0) {`;
const summaryReplacement = `  }, [actionableItems]);

  const toggleDemoMode = () => {
    const next = !demoMode;
    setDemoMode(next);
    setSelectedProductId(
      next
        ? RESTOCK_FORECAST_DEMO_PRODUCT_ID
        : (items.find((item) => item.forecast?.points.length)?.product.id ??
            items[0]?.product.id ??
            null)
    );
  };

  if (loading && items.length === 0) {`;
if (!source.includes("const toggleDemoMode = () =>")) {
  if (!source.includes(summaryEnd)) throw new Error("summary end not found");
  source = source.replace(summaryEnd, summaryReplacement);
}

const refreshButton = `          <Button
            disabled={loading}
            onClick={() => setLocalRefreshVersion((version) => version + 1)}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>`;
const refreshReplacement = `          <div className="flex flex-wrap gap-2">
            {import.meta.env.DEV ? (
              <Button onClick={toggleDemoMode} size="sm" type="button" variant="secondary">
                {demoMode ? "Exit test forecast" : "Show test forecast"}
              </Button>
            ) : null}
            <Button
              disabled={loading}
              onClick={() => setLocalRefreshVersion((version) => version + 1)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          </div>`;
if (!source.includes("Show test forecast")) {
  const index = source.indexOf(refreshButton, source.indexOf("<CardTitle>Restock forecast</CardTitle>"));
  if (index === -1) throw new Error("header refresh button not found");
  source = source.slice(0, index) + refreshReplacement + source.slice(index + refreshButton.length);
}

const metricsBlock = `        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ForecastMetric label="Needs action" value={summary.actionCount} />
          <ForecastMetric label="High risk" value={summary.highRisk} />
          <ForecastMetric label="Stockout within 7d" value={summary.sevenDayStockouts} />
          <ForecastMetric label="Suggested units" value={summary.units} />
        </div>`;
const metricsReplacement = `${metricsBlock}

        {demoMode ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-950">Temporary test forecast</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              Demo data only. Nothing is written to sales, inventory, forecast batches, or restock
              drafts. Exit test forecast to return to live data.
            </p>
          </div>
        ) : null}`;
if (!source.includes("Temporary test forecast")) {
  if (!source.includes(metricsBlock)) throw new Error("metrics block not found");
  source = source.replace(metricsBlock, metricsReplacement);
}

source = source.replace("{items.length > 0 ? (", "{displayItems.length > 0 ? (");
source = source.replace("{items.slice(0, 12).map((item) => {", "{displayItems.slice(0, 12).map((item) => {");

writeFileSync(path, source);
