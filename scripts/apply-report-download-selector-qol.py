from pathlib import Path

reports_path = Path("frontend/src/pages/ReportsPage.tsx")
reports = reports_path.read_text()

reports = reports.replace(
'''  Download,\n  FileSpreadsheet,\n  PackageOpen,\n  Printer,\n''',
'''  Download,\n  PackageOpen,\n''',
1,
)
reports = reports.replace(
'import { RestockPlanningPanel } from "@/components/reports/RestockPlanningPanel";\n',
'import { ReportDownloadDialog } from "@/components/reports/ReportDownloadDialog";\nimport { RestockPlanningPanel } from "@/components/reports/RestockPlanningPanel";\n',
1,
)
reports = reports.replace(
'''import {\n  Dialog,\n  DialogContent,\n  DialogDescription,\n  DialogHeader,\n  DialogTitle\n} from "@/components/ui/dialog";\nimport { fetchInventory, type InventoryRecord, type PaginationMeta } from "@/services/catalogApi";\n''',
'',
1,
)
reports = reports.replace(
'import { listRestockPlanning, type RestockPlanningCandidate } from "@/services/restockApi";\n',
'',
1,
)
reports = reports.replace(
'''const generatedAtFormatter = new Intl.DateTimeFormat("en-PH", {\n  dateStyle: "medium",\n  timeStyle: "short",\n  timeZone: "Asia/Manila"\n});\n\nconst EXPORT_PAGE_SIZE = 100;\n''',
'',
1,
)
reports = reports.replace(
'''type ReportExportSnapshot = {\n  completedSales: PosSale[];\n  inventory: InventoryRecord[];\n  restock: RestockPlanningCandidate[];\n  summary: DashboardSummary;\n};\n\n''',
'',
1,
)
reports = reports.replace(
'''function formatGeneratedAt(value: string) {\n  return generatedAtFormatter.format(new Date(value));\n}\n\n''',
'',
1,
)
reports = reports.replace(
'''  const [exportBusy, setExportBusy] = useState<"csv" | "print" | null>(null);\n  const [exportError, setExportError] = useState<string | null>(null);\n''',
'',
1,
)
start = reports.find('  async function prepareExportSnapshot(): Promise<ReportExportSnapshot> {')
end = reports.find('  return (', start)
if start == -1 or end == -1:
    raise SystemExit("Export handler block marker not found")
reports = reports[:start] + reports[end:]
reports = reports.replace(
'description="A live operational report for sales, stock, expiry, and restock. Restock actions are grouped separately below and kept near the top so the most important work stays visible."',
'description="Live store overview with restock planning and separate downloadable reports for management, inventory, and suppliers."',
1,
)
reports = reports.replace(
'''              onClick={() => {\n                setExportError(null);\n                setExportOpen(true);\n              }}\n''',
'''              onClick={() => setExportOpen(true)}\n''',
1,
)
reports = reports.replace('              Operational snapshot\n', '              Download report\n', 1)
reports = reports.replace(
'''                  Based on recent completed receipts · Internal details are available in Operational\n                  snapshot.\n''',
'''                  Based on recent completed receipts · Use Download report for printable or spreadsheet copies.\n''',
1,
)
old_dialog_start = reports.find('      <Dialog onOpenChange={setExportOpen} open={exportOpen}>')
old_dialog_end_marker = '      </Dialog>\n'
old_dialog_end = reports.find(old_dialog_end_marker, old_dialog_start)
if old_dialog_start == -1 or old_dialog_end == -1:
    raise SystemExit("Old report dialog marker not found")
old_dialog_end += len(old_dialog_end_marker)
new_dialog = '''      <ReportDownloadDialog\n        completedSales={completedSales}\n        onOpenChange={setExportOpen}\n        open={exportOpen}\n        summary={summary}\n      />\n'''
reports = reports[:old_dialog_start] + new_dialog + reports[old_dialog_end:]
helper_start = reports.find('async function fetchAllInventory()')
if helper_start == -1:
    raise SystemExit("Legacy report helper marker not found")
reports = reports[:helper_start].rstrip() + "\n"
reports_path.write_text(reports)

api_path = Path("frontend/src/services/restockApi.ts")
api = api_path.read_text()
insert_marker = 'export async function dismissRestockRecommendation(recommendationId: string, reason: string) {'
if insert_marker not in api:
    raise SystemExit("restockApi insertion marker not found")
list_fn = '''export async function listRestockOrders(\n  query: {\n    status?: RestockOrderStatus;\n    page?: number;\n    pageSize?: number;\n  } = {},\n  options: Pick<RequestInit, "signal"> = {}\n): Promise<{ items: RestockOrder[]; meta: PaginationMeta }> {\n  const queryString = buildQueryString(query);\n  const response = await apiClient.request<RestockOrder[], { code?: string }, PaginationMeta>(\n    `/api/restock-orders${queryString ? `?${queryString}` : ""}`,\n    options\n  );\n\n  if (!response.success || !response.data) {\n    throw new Error(response.message);\n  }\n\n  return {\n    items: response.data,\n    meta: response.meta ?? {\n      page: query.page ?? 1,\n      pageSize: query.pageSize ?? 20,\n      totalItems: response.data.length,\n      totalPages: 1\n    }\n  };\n}\n\n'''
api = api.replace(insert_marker, list_fn + insert_marker, 1)
api_path.write_text(api)

report_export = r'''import type { InventoryRecord } from "@/services/catalogApi";
import type { DashboardSummary } from "@/services/dashboardApi";
import type { PosSale } from "@/types/pos";

export type InternalReportSnapshot = {
  completedSales: PosSale[];
  inventory: InventoryRecord[];
  summary: DashboardSummary;
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila"
});

function currency(value: string | number) {
  return currencyFormatter.format(Number(value));
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function recentGross(snapshot: InternalReportSnapshot) {
  return snapshot.completedSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
}

function recentUnits(snapshot: InternalReportSnapshot) {
  return snapshot.completedSales.reduce((sum, sale) => sum + sale.itemCount, 0);
}

function totalUnitsOnHand(snapshot: InternalReportSnapshot) {
  return snapshot.inventory.reduce((sum, item) => sum + item.currentQuantity, 0);
}

function averageReceipt(snapshot: InternalReportSnapshot) {
  return snapshot.completedSales.length > 0 ? recentGross(snapshot) / snapshot.completedSales.length : 0;
}

function safeCsvText(value: string) {
  const normalized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${normalized.replaceAll('"', '""')}"`;
}

function toCsvCell(value: string | number) {
  return typeof value === "number" ? String(value) : safeCsvText(String(value ?? ""));
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function fileDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function renderPrintDocument(printWindow: Window, html: string) {
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
}

export function downloadOperationalSummaryCsv(snapshot: InternalReportSnapshot) {
  const rows: Array<Array<string | number>> = [
    ["YSABELLE STORE", "OPERATIONAL SUMMARY"],
    ["Generated", formatDateTime(snapshot.summary.generatedAt)],
    [],
    ["Metric", "Value"],
    ["Today's sales", Number(snapshot.summary.sales.todayAmount)],
    ["Recent gross", recentGross(snapshot)],
    ["Completed receipts", snapshot.completedSales.length],
    ["Units sold", recentUnits(snapshot)],
    ["Average receipt", averageReceipt(snapshot)],
    ["Tracked products", snapshot.summary.inventory.trackedItems],
    ["Total units on hand", totalUnitsOnHand(snapshot)],
    ["Active products", snapshot.summary.inventory.availableItems],
    ["Inactive / stopped", snapshot.summary.inventory.unavailableItems],
    ["Low stock", snapshot.summary.inventory.lowStockItems],
    ["Out of stock", snapshot.summary.inventory.outOfStockItems],
    ["Near-expiry batches", snapshot.summary.expiry.nearExpiryBatches],
    ["Expired batches", snapshot.summary.expiry.expiredBatches]
  ];

  downloadCsv(`ysabelle-operational-summary-${fileDate(snapshot.summary.generatedAt)}.csv`, rows);
}

export function downloadInventoryReportCsv(snapshot: InternalReportSnapshot) {
  const rows: Array<Array<string | number>> = [
    ["YSABELLE STORE", "INVENTORY REPORT"],
    ["Generated", formatDateTime(snapshot.summary.generatedAt)],
    ["Tracked products", snapshot.summary.inventory.trackedItems],
    ["Total units on hand", totalUnitsOnHand(snapshot)],
    ["Low stock", snapshot.summary.inventory.lowStockItems],
    ["Out of stock", snapshot.summary.inventory.outOfStockItems],
    [],
    [
      "SKU",
      "Product",
      "Category",
      "Product status",
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
      item.nearestExpiry ? formatDateTime(item.nearestExpiry) : ""
    ])
  ];

  downloadCsv(`ysabelle-inventory-report-${fileDate(snapshot.summary.generatedAt)}.csv`, rows);
}

export function printOperationalSummary(printWindow: Window, snapshot: InternalReportSnapshot) {
  const summary = snapshot.summary;
  const healthyInventory = summary.inventory.lowStockItems === 0 && summary.inventory.outOfStockItems === 0;
  const expiryClear = summary.expiry.nearExpiryBatches === 0 && summary.expiry.expiredBatches === 0;

  renderPrintDocument(
    printWindow,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Ysabelle Store Operational Summary</title>
  <style>
    @page { margin: 16mm; size: A4; }
    * { box-sizing: border-box; }
    body { color: #0f172a; font: 12px/1.5 Arial, sans-serif; margin: 0; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 22px; }
    h2 { font-size: 14px; margin-bottom: 8px; }
    .meta { color: #64748b; margin-top: 4px; }
    .section { margin-top: 20px; }
    .grid { display: grid; gap: 8px; grid-template-columns: repeat(4, 1fr); }
    .metric { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
    .metric span { color: #64748b; display: block; font-size: 10px; text-transform: uppercase; }
    .metric strong { display: block; font-size: 16px; margin-top: 3px; }
    .status-grid { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }
    .status { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .status strong { display: block; margin-bottom: 3px; }
    .note { color: #64748b; font-size: 10px; margin-top: 18px; }
  </style>
</head>
<body>
  <header>
    <h1>YSABELLE STORE — Operational Summary</h1>
    <div class="meta">Generated ${escapeHtml(formatDateTime(summary.generatedAt))}</div>
  </header>

  <section class="section">
    <h2>Sales overview</h2>
    <div class="grid">
      <div class="metric"><span>Today's sales</span><strong>${escapeHtml(currency(summary.sales.todayAmount))}</strong></div>
      <div class="metric"><span>Recent gross</span><strong>${escapeHtml(currency(recentGross(snapshot)))}</strong></div>
      <div class="metric"><span>Receipts</span><strong>${snapshot.completedSales.length.toLocaleString()}</strong></div>
      <div class="metric"><span>Units sold</span><strong>${recentUnits(snapshot).toLocaleString()}</strong></div>
    </div>
  </section>

  <section class="section">
    <h2>Inventory overview</h2>
    <div class="grid">
      <div class="metric"><span>Tracked products</span><strong>${summary.inventory.trackedItems.toLocaleString()}</strong></div>
      <div class="metric"><span>Total units on hand</span><strong>${totalUnitsOnHand(snapshot).toLocaleString()}</strong></div>
      <div class="metric"><span>Low stock</span><strong>${summary.inventory.lowStockItems.toLocaleString()}</strong></div>
      <div class="metric"><span>Out of stock</span><strong>${summary.inventory.outOfStockItems.toLocaleString()}</strong></div>
    </div>
  </section>

  <section class="section status-grid">
    <div class="status"><strong>Inventory status</strong>${healthyInventory ? "No low-stock or out-of-stock products need attention." : "Inventory has products that need replenishment attention."}</div>
    <div class="status"><strong>Expiry status</strong>${expiryClear ? "No expiry issues need attention right now." : `${summary.expiry.nearExpiryBatches.toLocaleString()} near-expiry and ${summary.expiry.expiredBatches.toLocaleString()} expired batches need review.`}</div>
  </section>

  <p class="note">This is a management summary. Use the separate Inventory Report for product-level stock rows and Restock / Supplier Order for supplier-facing quantities.</p>
</body>
</html>`
  );
}

export function printInventoryReport(printWindow: Window, snapshot: InternalReportSnapshot) {
  const rows = snapshot.inventory
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.sku)}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.stockStatus.replaceAll("_", " "))}</td>
          <td class="number">${item.currentQuantity.toLocaleString()}</td>
          <td class="number">${item.availableQuantity.toLocaleString()}</td>
          <td class="number">${item.reorderLevel.toLocaleString()}</td>
          <td class="number">${item.targetStockLevel.toLocaleString()}</td>
        </tr>`
    )
    .join("");

  renderPrintDocument(
    printWindow,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Ysabelle Store Inventory Report</title>
  <style>
    @page { margin: 12mm; size: A4 landscape; }
    * { box-sizing: border-box; }
    body { color: #0f172a; font: 10px/1.4 Arial, sans-serif; margin: 0; }
    h1, p { margin: 0; }
    h1 { font-size: 20px; }
    .meta { color: #64748b; margin-top: 3px; }
    .summary { display: grid; gap: 8px; grid-template-columns: repeat(6, 1fr); margin: 14px 0; }
    .metric { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; }
    .metric span { color: #64748b; display: block; font-size: 9px; text-transform: uppercase; }
    .metric strong { display: block; font-size: 14px; margin-top: 2px; }
    table { border-collapse: collapse; width: 100%; }
    thead { display: table-header-group; }
    th { background: #f1f5f9; color: #475569; font-size: 9px; text-transform: uppercase; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; vertical-align: top; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .number { text-align: right; white-space: nowrap; }
  </style>
</head>
<body>
  <header>
    <h1>YSABELLE STORE — Inventory Report</h1>
    <div class="meta">Generated ${escapeHtml(formatDateTime(snapshot.summary.generatedAt))}</div>
  </header>

  <div class="summary">
    <div class="metric"><span>Tracked products</span><strong>${snapshot.summary.inventory.trackedItems.toLocaleString()}</strong></div>
    <div class="metric"><span>Total units on hand</span><strong>${totalUnitsOnHand(snapshot).toLocaleString()}</strong></div>
    <div class="metric"><span>Active products</span><strong>${snapshot.summary.inventory.availableItems.toLocaleString()}</strong></div>
    <div class="metric"><span>Inactive / stopped</span><strong>${snapshot.summary.inventory.unavailableItems.toLocaleString()}</strong></div>
    <div class="metric"><span>Low stock</span><strong>${snapshot.summary.inventory.lowStockItems.toLocaleString()}</strong></div>
    <div class="metric"><span>Out of stock</span><strong>${snapshot.summary.inventory.outOfStockItems.toLocaleString()}</strong></div>
  </div>

  <table>
    <thead>
      <tr><th>SKU</th><th>Product</th><th>Product status</th><th>Stock status</th><th class="number">On hand</th><th class="number">Available</th><th class="number">Reorder</th><th class="number">Target</th></tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="8">No inventory rows.</td></tr>'}</tbody>
  </table>
</body>
</html>`
  );
}
'''
Path("frontend/src/utils/reportExport.ts").write_text(report_export)

report_dialog = r'''import {
  Boxes,
  CheckCircle2,
  FileSpreadsheet,
  PackageOpen,
  Printer,
  ReceiptText
} from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { fetchInventory, type InventoryRecord, type PaginationMeta } from "@/services/catalogApi";
import type { DashboardSummary } from "@/services/dashboardApi";
import {
  listRestockOrders,
  type RestockOrder,
  type RestockOrderStatus
} from "@/services/restockApi";
import type { PosSale } from "@/types/pos";
import {
  downloadInventoryReportCsv,
  downloadOperationalSummaryCsv,
  printInventoryReport,
  printOperationalSummary,
  type InternalReportSnapshot
} from "@/utils/reportExport";
import {
  downloadRestockSupplierCsv,
  printRestockSupplierCopy,
  type RestockSupplierSnapshot
} from "@/utils/restockExport";

const EXPORT_PAGE_SIZE = 100;
const REPORT_TYPE_SESSION_KEY = "ysabelle.report-download.type";
const SUPPLIER_EXPORT_STATUSES: RestockOrderStatus[] = [
  "APPROVED",
  "AWAITING_DELIVERY",
  "PARTIALLY_RECEIVED"
];

type ReportType = "operational" | "inventory" | "restock";
type ExportBusy = "csv" | "print" | null;

type Props = {
  completedSales: PosSale[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  summary: DashboardSummary | null;
};

function initialReportType(): ReportType {
  if (typeof window === "undefined") return "operational";
  const saved = window.sessionStorage.getItem(REPORT_TYPE_SESSION_KEY);
  return saved === "inventory" || saved === "restock" ? saved : "operational";
}

export function ReportDownloadDialog({ completedSales, onOpenChange, open, summary }: Props) {
  const [reportType, setReportType] = useState<ReportType>(initialReportType);
  const [exportBusy, setExportBusy] = useState<ExportBusy>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [supplierOrder, setSupplierOrder] = useState<RestockOrder | null>(null);
  const [supplierOrderLoading, setSupplierOrderLoading] = useState(false);
  const [supplierOrderError, setSupplierOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSupplierOrderLoading(true);
    setSupplierOrderError(null);

    void fetchLatestSupplierOrder()
      .then((order) => {
        if (active) setSupplierOrder(order);
      })
      .catch((error) => {
        if (!active) return;
        setSupplierOrder(null);
        setSupplierOrderError(
          error instanceof Error ? error.message : "Confirmed restock orders could not be loaded."
        );
      })
      .finally(() => {
        if (active) setSupplierOrderLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  function chooseReport(type: ReportType) {
    setReportType(type);
    setExportError(null);
    window.sessionStorage.setItem(REPORT_TYPE_SESSION_KEY, type);
  }

  async function prepareInternalSnapshot(): Promise<InternalReportSnapshot> {
    if (!summary) throw new Error("Report data is not ready yet.");
    const inventory = await fetchAllInventory();
    return { completedSales, inventory, summary };
  }

  async function handleCsv() {
    setExportBusy("csv");
    setExportError(null);

    try {
      if (reportType === "restock") {
        const snapshot = supplierOrder ? buildSupplierSnapshot(supplierOrder) : null;
        if (!snapshot) throw new Error("Confirm a restock order before exporting a supplier copy.");
        downloadRestockSupplierCsv(snapshot);
      } else {
        const snapshot = await prepareInternalSnapshot();
        if (reportType === "inventory") downloadInventoryReportCsv(snapshot);
        else downloadOperationalSummaryCsv(snapshot);
      }
      onOpenChange(false);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The report could not be exported.");
    } finally {
      setExportBusy(null);
    }
  }

  async function handlePrint() {
    setExportError(null);

    if (reportType === "restock") {
      const snapshot = supplierOrder ? buildSupplierSnapshot(supplierOrder) : null;
      if (!snapshot) {
        setExportError("Confirm a restock order before exporting a supplier copy.");
        return;
      }
      if (!printRestockSupplierCopy(snapshot)) {
        setExportError("Pop-up was blocked. Allow pop-ups for Ysabelle Store and try again.");
        return;
      }
      onOpenChange(false);
      return;
    }

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
      const snapshot = await prepareInternalSnapshot();
      if (reportType === "inventory") printInventoryReport(printWindow, snapshot);
      else printOperationalSummary(printWindow, snapshot);
      onOpenChange(false);
    } catch (error) {
      printWindow.close();
      setExportError(error instanceof Error ? error.message : "The report could not be prepared.");
    } finally {
      setExportBusy(null);
    }
  }

  const restockDisabled =
    reportType === "restock" && (supplierOrderLoading || supplierOrderError !== null || !supplierOrder);

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setExportError(null);
      }}
      open={open}
    >
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Download report</DialogTitle>
          <DialogDescription>
            Choose the report you need. Internal store data stays separate from the supplier-facing restock order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Report type
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <ReportChoice
                active={reportType === "operational"}
                description="Store health and sales overview"
                icon={ReceiptText}
                onClick={() => chooseReport("operational")}
                title="Operational Summary"
              />
              <ReportChoice
                active={reportType === "inventory"}
                description="Full current stock and inventory status"
                icon={Boxes}
                onClick={() => chooseReport("inventory")}
                title="Inventory Report"
              />
              <ReportChoice
                active={reportType === "restock"}
                description="Products and quantities to send to supplier"
                icon={PackageOpen}
                onClick={() => chooseReport("restock")}
                title="Restock / Supplier Order"
              />
            </div>
          </div>

          {reportType === "restock" ? (
            supplierOrderLoading ? (
              <Alert>
                <AlertTitle>Checking confirmed restock orders</AlertTitle>
                <AlertDescription>Finding the latest supplier-ready restock order.</AlertDescription>
              </Alert>
            ) : supplierOrderError ? (
              <Alert variant="destructive">
                <AlertTitle>Restock order could not be loaded</AlertTitle>
                <AlertDescription>{supplierOrderError}</AlertDescription>
              </Alert>
            ) : supplierOrder ? (
              <Alert>
                <AlertTitle>Supplier copy ready</AlertTitle>
                <AlertDescription>
                  {supplierOrder.orderNumber} · {selectedLineCount(supplierOrder).toLocaleString()} products · {selectedUnitCount(supplierOrder).toLocaleString()} units
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTitle>No confirmed restock order yet</AlertTitle>
                <AlertDescription>
                  Confirm the Restock Planner first. Drafts are intentionally not exported as supplier orders.
                </AlertDescription>
              </Alert>
            )
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Export format
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="h-auto min-h-20 items-start justify-start whitespace-normal p-4 text-left"
                disabled={exportBusy !== null || restockDisabled || !summary}
                onClick={() => void handlePrint()}
                type="button"
                variant="secondary"
              >
                <Printer className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold text-slate-950">
                    {exportBusy === "print" ? "Preparing…" : "Print / Save PDF"}
                  </span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                    Clean print view for paper or Save as PDF.
                  </span>
                </span>
              </Button>

              <Button
                className="h-auto min-h-20 items-start justify-start whitespace-normal p-4 text-left"
                disabled={exportBusy !== null || restockDisabled || !summary}
                onClick={() => void handleCsv()}
                type="button"
                variant="secondary"
              >
                <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold text-slate-950">
                    {exportBusy === "csv" ? "Preparing…" : "Excel-compatible CSV"}
                  </span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                    Spreadsheet-ready copy of the selected report.
                  </span>
                </span>
              </Button>
            </div>
          </div>

          {exportError ? (
            <Alert variant="destructive">
              <AlertTitle>Export needs attention</AlertTitle>
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportChoice({
  active,
  description,
  icon: Icon,
  onClick,
  title
}: {
  active: boolean;
  description: string;
  icon: typeof ReceiptText;
  onClick: () => void;
  title: string;
}) {
  return (
    <Button
      aria-pressed={active}
      className={`h-auto min-h-28 items-start justify-start whitespace-normal p-4 text-left ${
        active ? "ring-2 ring-indigo-500" : ""
      }`}
      onClick={onClick}
      type="button"
      variant="secondary"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold text-slate-950">
          {title}
          {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
        </span>
        <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </Button>
  );
}

async function fetchAllInventory() {
  return fetchEveryPage<InventoryRecord>((page) =>
    fetchInventory({ page, pageSize: EXPORT_PAGE_SIZE })
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
    if (page >= result.meta.totalPages) return items;
    page += 1;
  }
}

async function fetchLatestSupplierOrder() {
  const results = await Promise.all(
    SUPPLIER_EXPORT_STATUSES.map((status) =>
      listRestockOrders({ page: 1, pageSize: 1, status })
    )
  );

  return (
    results
      .flatMap((result) => result.items)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null
  );
}

function selectedLineCount(order: RestockOrder) {
  return order.lines.filter((line) => line.isSelected && line.requestedQuantity > 0).length;
}

function selectedUnitCount(order: RestockOrder) {
  return order.lines
    .filter((line) => line.isSelected && line.requestedQuantity > 0)
    .reduce((sum, line) => sum + line.requestedQuantity, 0);
}

function statusLabel(status: RestockOrderStatus) {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function buildSupplierSnapshot(order: RestockOrder): RestockSupplierSnapshot | null {
  const lines = order.lines
    .filter((line) => line.isSelected && line.requestedQuantity > 0)
    .map((line) => ({
      barcode: line.product.barcode,
      notes: line.notes ?? null,
      productName: line.product.name,
      quantity: line.requestedQuantity,
      sku: line.product.sku
    }));

  if (lines.length === 0) return null;

  return {
    generatedAt: new Date().toISOString(),
    lines,
    notes: order.notes,
    orderNumber: order.orderNumber,
    preparedBy: order.approvedBy?.name ?? order.createdBy?.name ?? null,
    statusLabel: statusLabel(order.status)
  };
}
'''
Path("frontend/src/components/reports/ReportDownloadDialog.tsx").write_text(report_dialog)

contract_path = Path("scripts/restock-phase4-6-ui-contract-test.ts")
contract = contract_path.read_text()
contract = contract.replace(
'''const apiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");\n''',
'''const apiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");\nconst reportDialogSource = readFileSync(\n  resolve(process.cwd(), "src/components/reports/ReportDownloadDialog.tsx"),\n  "utf8"\n);\nconst reportExportSource = readFileSync(resolve(process.cwd(), "src/utils/reportExport.ts"), "utf8");\n''',
1,
)
contract = contract.replace('assert.match(reportsSource, /Restock actions are grouped separately below/);\n', '')
contract = contract.replace('assert.match(reportsSource, /Operational snapshot/);\n', 'assert.match(reportsSource, /Download report/);\n')
contract = contract.replace('assert.match(reportsSource, /Print \\/ Save PDF/);\n', '')
contract = contract.replace('assert.match(reportsSource, /Excel-compatible CSV/);\n', '')
contract = contract.replace('assert.match(reportsSource, /fetchAllInventory/);\n', '')
contract = contract.replace('assert.match(reportsSource, /fetchAllRestockPlanning/);\n', '')
contract = contract.replace(
'''assert.doesNotMatch(reportsSource, /Operational snapshot only\\. Download the report/);\n''',
'''assert.doesNotMatch(reportsSource, /Internal operational snapshot/);\nassert.match(reportsSource, /ReportDownloadDialog/);\n''',
1,
)
insert_after = '''assert.match(apiSource, /\\/api\\/restock-orders\\/\\$\\{encodeURIComponent\\(orderId\\)\\}\\/approve/);\n'''
if insert_after not in contract:
    raise SystemExit("Contract API insertion marker not found")
contract = contract.replace(
    insert_after,
    insert_after
    + '''assert.match(apiSource, /export async function listRestockOrders/);\n\nassert.match(reportDialogSource, /Download report/);\nassert.match(reportDialogSource, /Operational Summary/);\nassert.match(reportDialogSource, /Inventory Report/);\nassert.match(reportDialogSource, /Restock \\/ Supplier Order/);\nassert.match(reportDialogSource, /Print \\/ Save PDF/);\nassert.match(reportDialogSource, /Excel-compatible CSV/);\nassert.match(reportDialogSource, /No confirmed restock order yet/);\nassert.match(reportDialogSource, /REPORT_TYPE_SESSION_KEY/);\n\nassert.match(reportExportSource, /OPERATIONAL SUMMARY/);\nassert.match(reportExportSource, /INVENTORY REPORT/);\nassert.match(reportExportSource, /Total units on hand/);\nassert.doesNotMatch(reportExportSource, /RESTOCK RECOMMENDATIONS/);\n''',
    1,
)
contract_path.write_text(contract)
