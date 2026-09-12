import type { InventoryRecord } from "@/services/catalogApi";
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
  return snapshot.completedSales.length > 0
    ? recentGross(snapshot) / snapshot.completedSales.length
    : 0;
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
  const healthyInventory =
    summary.inventory.lowStockItems === 0 && summary.inventory.outOfStockItems === 0;
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
