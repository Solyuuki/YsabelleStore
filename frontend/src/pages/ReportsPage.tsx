import {
  Boxes,
  CalendarClock,
  Download,
  FileSpreadsheet,
  PackageOpen,
  Printer,
  ReceiptText,
  RefreshCw,
  TriangleAlert
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { RestockPlanningPanel } from "@/components/reports/RestockPlanningPanel";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { fetchInventory, type InventoryRecord, type PaginationMeta } from "@/services/catalogApi";
import { fetchDashboardSummary, type DashboardSummary } from "@/services/dashboardApi";
import { listRecentSales } from "@/services/posService";
import { listRestockPlanning, type RestockPlanningCandidate } from "@/services/restockApi";
import type { PosSale } from "@/types/pos";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const generatedAtFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila"
});

const EXPORT_PAGE_SIZE = 100;
const AVAILABILITY_COLORS = ["#4f46e5", "#e2e8f0"];

type ReportExportSnapshot = {
  completedSales: PosSale[];
  inventory: InventoryRecord[];
  restock: RestockPlanningCandidate[];
  summary: DashboardSummary;
};

type CompactStat = {
  detail: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  warning?: boolean;
};

function currency(value: string | number) {
  return currencyFormatter.format(Number(value));
}

function formatGeneratedAt(value: string) {
  return generatedAtFormatter.format(new Date(value));
}

export function ReportsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<"csv" | "print" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      setLoading(true);
      setError(null);

      try {
        const [dashboardResult, salesResult] = await Promise.all([
          fetchDashboardSummary(),
          listRecentSales(50)
        ]);

        if (!active) return;

        setSummary(dashboardResult);
        if (!salesResult.success || !salesResult.data) {
          setSales([]);
          setError(salesResult.message || "Recent sales could not be loaded.");
        } else {
          setSales(salesResult.data.sales);
        }
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Operational reports could not be loaded."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadReport();
    return () => {
      active = false;
    };
  }, [refreshVersion]);

  const completedSales = useMemo(
    () => sales.filter((sale) => sale.status === "COMPLETED"),
    [sales]
  );
  const recentGrossSales = useMemo(
    () => completedSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0),
    [completedSales]
  );
  const recentUnits = useMemo(
    () => completedSales.reduce((sum, sale) => sum + sale.itemCount, 0),
    [completedSales]
  );
  const averageReceipt = completedSales.length > 0 ? recentGrossSales / completedSales.length : 0;

  const compactStats: CompactStat[] = summary
    ? [
        {
          label: "Today's sales",
          value: currency(summary.sales.todayAmount),
          detail: `${summary.sales.completedSales} receipt${summary.sales.completedSales === 1 ? "" : "s"}`,
          icon: ReceiptText
        },
        {
          label: "Recent gross",
          value: currency(recentGrossSales),
          detail: `${completedSales.length} recent receipt${completedSales.length === 1 ? "" : "s"}`,
          icon: CalendarClock
        },
        {
          label: "Inventory",
          value: summary.inventory.trackedItems.toLocaleString(),
          detail: `${summary.inventory.inStockItems} healthy • ${summary.inventory.outOfStockItems} out`,
          icon: Boxes,
          warning: summary.inventory.outOfStockItems > 0
        },
        {
          label: "Low stock",
          value: summary.inventory.lowStockItems.toLocaleString(),
          detail: summary.inventory.lowStockItems > 0 ? "Needs attention" : "No items flagged",
          icon: PackageOpen,
          warning: summary.inventory.lowStockItems > 0
        },
        {
          label: "Expiry",
          value: summary.expiry.nearExpiryBatches.toLocaleString(),
          detail: `${summary.expiry.expiredBatches} expired`,
          icon: TriangleAlert,
          warning: summary.expiry.nearExpiryBatches > 0 || summary.expiry.expiredBatches > 0
        }
      ]
    : [];

  async function prepareExportSnapshot(): Promise<ReportExportSnapshot> {
    if (!summary) {
      throw new Error("Report data is not ready yet.");
    }

    const [inventory, restock] = await Promise.all([
      fetchAllInventory(),
      fetchAllRestockPlanning()
    ]);

    return {
      completedSales,
      inventory,
      restock,
      summary
    };
  }

  async function handleExportCsv() {
    setExportBusy("csv");
    setExportError(null);

    try {
      const snapshot = await prepareExportSnapshot();
      downloadReportCsv(snapshot);
      setExportOpen(false);
    } catch (exportRequestError) {
      setExportError(
        exportRequestError instanceof Error
          ? exportRequestError.message
          : "The spreadsheet report could not be prepared."
      );
    } finally {
      setExportBusy(null);
    }
  }

  async function handlePrintReport() {
    setExportError(null);

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      setExportError("Pop-up was blocked. Allow pop-ups for Ysabelle Store and try again.");
      return;
    }

    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(
      '<!doctype html><title>Preparing report…</title><p style="font:14px Arial;padding:24px">Preparing Ysabelle Store report…</p>'
    );
    printWindow.document.close();
    setExportBusy("print");

    try {
      const snapshot = await prepareExportSnapshot();
      renderPrintableReport(printWindow, snapshot);
      setExportOpen(false);
    } catch (exportRequestError) {
      printWindow.close();
      setExportError(
        exportRequestError instanceof Error
          ? exportRequestError.message
          : "The printable report could not be prepared."
      );
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Owner area"
        title="Reports"
        description="A live operational report for sales, stock, expiry, and restock. Restock actions are grouped separately below and kept near the top so the most important work stays visible."
        actions={
          <>
            <Button
              disabled={loading}
              onClick={() => setRefreshVersion((version) => version + 1)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
            <Button
              disabled={!summary || loading}
              onClick={() => {
                setExportError(null);
                setExportOpen(true);
              }}
              size="sm"
              type="button"
            >
              <Download className="h-4 w-4" />
              Download report
            </Button>
          </>
        }
      />

      {loading && !summary ? (
        <LoadingState
          badge="Loading"
          helper="Reading sales, inventory, and expiry data from the live backend."
          label="Building operational report"
        />
      ) : null}

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {summary ? (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 xl:grid-cols-5 xl:divide-y-0">
                {compactStats.map((stat) => (
                  <CompactSummaryStat key={stat.label} {...stat} />
                ))}
              </div>
              <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                Live snapshot generated {formatGeneratedAt(summary.generatedAt)}. Recent sales
                metrics use up to the latest 50 persisted sale records.
              </div>
            </CardContent>
          </Card>

          <RestockPlanningPanel />

          <section className="grid items-start gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Recent receipt metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                  <MiniMetric label="Receipts" value={completedSales.length.toLocaleString()} />
                  <MiniMetric label="Units sold" value={recentUnits.toLocaleString()} />
                  <MiniMetric label="Gross sales" value={currency(recentGrossSales)} />
                  <MiniMetric label="Average receipt" value={currency(averageReceipt)} />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Operational snapshot only. Download the report for a clean printable or
                  spreadsheet copy with detailed stock rows.
                </p>
              </CardContent>
            </Card>

            <InventoryHealthCard summary={summary} />
          </section>
        </>
      ) : null}

      <Dialog onOpenChange={setExportOpen} open={exportOpen}>
        <DialogContent className="max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Download report</DialogTitle>
            <DialogDescription>
              Export the current live snapshot. Both formats include detailed inventory and current
              restock recommendations without changing any store data.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
            <Button
              className="h-auto min-h-24 items-start justify-start whitespace-normal p-4 text-left"
              disabled={exportBusy !== null}
              onClick={() => void handlePrintReport()}
              type="button"
              variant="secondary"
            >
              <Printer className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <span className="block font-semibold text-slate-950">
                  {exportBusy === "print" ? "Preparing…" : "Print / Save PDF"}
                </span>
                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                  Opens a clean print view. Choose Save as PDF or print directly.
                </span>
              </span>
            </Button>

            <Button
              className="h-auto min-h-24 items-start justify-start whitespace-normal p-4 text-left"
              disabled={exportBusy !== null}
              onClick={() => void handleExportCsv()}
              type="button"
              variant="secondary"
            >
              <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <span className="block font-semibold text-slate-950">
                  {exportBusy === "csv" ? "Preparing…" : "Excel-compatible CSV"}
                </span>
                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                  Downloads a spreadsheet-ready file with inventory and restock detail.
                </span>
              </span>
            </Button>
          </div>

          {exportError ? (
            <div className="mx-6 mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {exportError}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompactSummaryStat({ detail, icon: Icon, label, value, warning }: CompactStat) {
  return (
    <div className="min-w-0 p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className={warning ? "h-4 w-4 text-amber-500" : "h-4 w-4 text-indigo-500"} />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p
        className={
          warning ? "mt-1 truncate text-xs text-amber-700" : "mt-1 truncate text-xs text-slate-500"
        }
      >
        {detail}
      </p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function InventoryHealthCard({ summary }: { summary: DashboardSummary }) {
  const inventory = summary.inventory;
  const availabilityData = [
    { name: "Active", value: inventory.availableItems },
    { name: "Inactive", value: inventory.unavailableItems }
  ];
  const healthy = inventory.lowStockItems === 0 && inventory.outOfStockItems === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Inventory health</CardTitle>
          <StatusBadge variant={healthy ? "success" : "warning"}>
            {healthy ? "Stock healthy" : "Needs attention"}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid items-center gap-4 sm:grid-cols-[120px_1fr]">
          <div className="mx-auto h-24 w-24">
            {inventory.catalogItems > 0 ? (
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={availabilityData}
                    dataKey="value"
                    innerRadius={28}
                    outerRadius={43}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {availabilityData.map((entry, index) => (
                      <Cell
                        fill={AVAILABILITY_COLORS[index]}
                        key={`${entry.name}-${entry.value}`}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-full border border-dashed border-slate-200 text-xs text-slate-400">
                No data
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <HealthValue label="Catalog" value={inventory.catalogItems} />
            <HealthValue label="Inventory records" value={inventory.trackedItems} />
            <HealthValue label="Active products" value={inventory.availableItems} />
            <HealthValue label="Inactive / stopped" value={inventory.unavailableItems} />
            <HealthValue label="Healthy stock" value={inventory.inStockItems} />
            <HealthValue
              label="Low / out"
              value={inventory.lowStockItems + inventory.outOfStockItems}
              warning={!healthy}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>
            <span className="font-semibold text-slate-700">{inventory.availableItems}</span> active
          </span>
          <span>
            <span className="font-semibold text-slate-700">{inventory.unavailableItems}</span>{" "}
            inactive
          </span>
          <span>
            <span className="font-semibold text-slate-700">{inventory.lowStockItems}</span> low
            stock
          </span>
          <span>
            <span className="font-semibold text-slate-700">{inventory.outOfStockItems}</span> out of
            stock
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthValue({
  label,
  value,
  warning = false
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-slate-500">{label}</p>
      <p
        className={
          warning ? "text-lg font-semibold text-amber-700" : "text-lg font-semibold text-slate-950"
        }
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

async function fetchAllInventory() {
  return fetchEveryPage<InventoryRecord>((page) =>
    fetchInventory({ page, pageSize: EXPORT_PAGE_SIZE })
  );
}

async function fetchAllRestockPlanning() {
  return fetchEveryPage<RestockPlanningCandidate>((page) =>
    listRestockPlanning({ page, pageSize: EXPORT_PAGE_SIZE })
  );
}

async function fetchEveryPage<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; meta: PaginationMeta }>
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const result = await fetchPage(page);
    items.push(...result.items);

    if (page >= result.meta.totalPages) {
      return items;
    }

    page += 1;
  }
}

function downloadReportCsv(snapshot: ReportExportSnapshot) {
  const rows: Array<Array<string | number>> = [
    ["YSABELLE STORE", "Operational Report"],
    ["Generated", formatGeneratedAt(snapshot.summary.generatedAt)],
    [],
    ["REPORT SUMMARY"],
    ["Metric", "Value"],
    ["Today's sales", Number(snapshot.summary.sales.todayAmount)],
    ["Today's completed receipts", snapshot.summary.sales.completedSales],
    ["Tracked inventory", snapshot.summary.inventory.trackedItems],
    ["Low stock", snapshot.summary.inventory.lowStockItems],
    ["Out of stock", snapshot.summary.inventory.outOfStockItems],
    ["Near-expiry batches", snapshot.summary.expiry.nearExpiryBatches],
    ["Expired batches", snapshot.summary.expiry.expiredBatches],
    [],
    ["RECENT SALES"],
    ["Sale number", "Date", "Cashier", "Units", "Total", "Status"],
    ...snapshot.completedSales.map((sale) => [
      sale.saleNumber,
      formatGeneratedAt(sale.saleDate),
      sale.cashierName ?? "—",
      sale.itemCount,
      Number(sale.totalAmount),
      sale.status
    ]),
    [],
    ["INVENTORY DETAIL"],
    [
      "SKU",
      "Product",
      "Category",
      "Status",
      "Stock status",
      "On hand",
      "Available",
      "Reorder level",
      "Target stock",
      "Nearest expiry"
    ],
    ...snapshot.inventory.map((item) => [
      item.sku,
      item.productName,
      item.category.name,
      item.status,
      item.stockStatus,
      item.currentQuantity,
      item.availableQuantity,
      item.reorderLevel,
      item.targetStockLevel,
      item.nearestExpiry ? formatGeneratedAt(item.nearestExpiry) : "—"
    ]),
    [],
    ["RESTOCK RECOMMENDATIONS"],
    [
      "SKU",
      "Product",
      "Source",
      "Sellable",
      "Physical",
      "Incoming",
      "Suggested quantity",
      "Rationale"
    ],
    ...snapshot.restock.map((item) => [
      item.product.sku,
      item.product.name,
      item.recommendationSource,
      item.sellableStock,
      item.physicalOnHand,
      item.incomingStock,
      item.recommendedQuantity,
      item.rationale
    ])
  ];

  const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ysabelle-operational-report-${fileDate(snapshot.summary.generatedAt)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function renderPrintableReport(printWindow: Window, snapshot: ReportExportSnapshot) {
  printWindow.document.open();
  printWindow.document.write(buildPrintableReport(snapshot));
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
}

function buildPrintableReport(snapshot: ReportExportSnapshot) {
  const summary = snapshot.summary;
  const salesGross = snapshot.completedSales.reduce(
    (total, sale) => total + Number(sale.totalAmount),
    0
  );
  const salesUnits = snapshot.completedSales.reduce((total, sale) => total + sale.itemCount, 0);
  const inventoryRows = snapshot.inventory
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.sku)}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.stockStatus.replaceAll("_", " "))}</td>
          <td class="number">${item.currentQuantity.toLocaleString()}</td>
          <td class="number">${item.reorderLevel.toLocaleString()}</td>
          <td class="number">${item.targetStockLevel.toLocaleString()}</td>
        </tr>`
    )
    .join("");
  const restockRows = snapshot.restock
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.product.sku)}</td>
          <td>${escapeHtml(item.product.name)}</td>
          <td>${escapeHtml(item.recommendationSource)}</td>
          <td class="number">${item.sellableStock.toLocaleString()}</td>
          <td class="number">${item.incomingStock.toLocaleString()}</td>
          <td class="number">${item.recommendedQuantity.toLocaleString()}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Ysabelle Store Operational Report</title>
  <style>
    @page { margin: 16mm; size: A4; }
    * { box-sizing: border-box; }
    body { color: #0f172a; font: 12px/1.45 Arial, sans-serif; margin: 0; }
    h1, h2 { margin: 0; }
    h1 { font-size: 22px; }
    h2 { font-size: 15px; margin-bottom: 8px; }
    .meta { color: #64748b; margin-top: 4px; }
    .summary { display: grid; gap: 8px; grid-template-columns: repeat(4, 1fr); margin: 18px 0; }
    .metric { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
    .metric span { color: #64748b; display: block; font-size: 10px; text-transform: uppercase; }
    .metric strong { display: block; font-size: 16px; margin-top: 3px; }
    section { break-inside: avoid; margin-top: 18px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 5px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #475569; font-size: 10px; text-transform: uppercase; }
    .number { text-align: right; }
    .note { color: #64748b; font-size: 10px; margin-top: 8px; }
    @media print { .screen-only { display: none; } }
  </style>
</head>
<body>
  <header>
    <h1>YSABELLE STORE — Operational Report</h1>
    <div class="meta">Generated ${escapeHtml(formatGeneratedAt(summary.generatedAt))}</div>
  </header>

  <div class="summary">
    <div class="metric"><span>Today's sales</span><strong>${escapeHtml(currency(summary.sales.todayAmount))}</strong></div>
    <div class="metric"><span>Recent gross</span><strong>${escapeHtml(currency(salesGross))}</strong></div>
    <div class="metric"><span>Inventory records</span><strong>${summary.inventory.trackedItems.toLocaleString()}</strong></div>
    <div class="metric"><span>Restock recommendations</span><strong>${snapshot.restock.length.toLocaleString()}</strong></div>
    <div class="metric"><span>Units sold</span><strong>${salesUnits.toLocaleString()}</strong></div>
    <div class="metric"><span>Low stock</span><strong>${summary.inventory.lowStockItems.toLocaleString()}</strong></div>
    <div class="metric"><span>Out of stock</span><strong>${summary.inventory.outOfStockItems.toLocaleString()}</strong></div>
    <div class="metric"><span>Expiry attention</span><strong>${summary.expiry.nearExpiryBatches.toLocaleString()}</strong></div>
  </div>

  <section>
    <h2>Inventory detail</h2>
    <table>
      <thead><tr><th>SKU</th><th>Product</th><th>Stock status</th><th class="number">On hand</th><th class="number">Reorder</th><th class="number">Target</th></tr></thead>
      <tbody>${inventoryRows || '<tr><td colspan="6">No inventory rows.</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Restock recommendations</h2>
    <table>
      <thead><tr><th>SKU</th><th>Product</th><th>Source</th><th class="number">Sellable</th><th class="number">Incoming</th><th class="number">Suggested</th></tr></thead>
      <tbody>${restockRows || '<tr><td colspan="6">No products currently require restocking.</td></tr>'}</tbody>
    </table>
    <p class="note">Restock quantities are planning recommendations only. Physical inventory changes only when goods are actually received.</p>
  </section>

  <p class="note">Recent sales metrics use up to the latest 50 persisted sale records. Inventory is a live snapshot as of report generation.</p>
</body>
</html>`;
}

function toCsvCell(value: string | number) {
  let text = String(value ?? "");

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string | number) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character] ?? character;
  });
}

function fileDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
