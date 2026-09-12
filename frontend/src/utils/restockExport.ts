export type RestockSupplierLine = {
  barcode: string | null;
  notes?: string | null;
  productName: string;
  quantity: number;
  sku: string;
};

export type RestockSupplierSnapshot = {
  generatedAt: string;
  notes?: string | null;
  orderNumber: string | null;
  preparedBy?: string | null;
  statusLabel: string;
  lines: RestockSupplierLine[];
};

const generatedAtFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila"
});

function formatGeneratedAt(value: string) {
  return generatedAtFormatter.format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeCsvText(value: string) {
  const normalized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${normalized.replaceAll('"', '""')}"`;
}

function supplierFilename(snapshot: RestockSupplierSnapshot, extension: string) {
  const reference = snapshot.orderNumber?.trim() || "restock-plan";
  const safeReference = reference.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `ysabelle-restock-${safeReference || "plan"}.${extension}`;
}

export function downloadRestockSupplierCsv(snapshot: RestockSupplierSnapshot) {
  const totalUnits = snapshot.lines.reduce((sum, line) => sum + line.quantity, 0);
  const rows: Array<Array<string | number>> = [
    ["YSABELLE STORE", "RESTOCK ORDER - SUPPLIER COPY"],
    ["Reference", snapshot.orderNumber ?? "Unconfirmed plan"],
    ["Status", snapshot.statusLabel],
    ["Generated", formatGeneratedAt(snapshot.generatedAt)],
    ["Prepared by", snapshot.preparedBy ?? ""],
    ["Supplier / Manufacturer", ""],
    ["Order notes", snapshot.notes ?? ""],
    [],
    ["SKU", "Barcode", "Product", "Order quantity", "Item note"],
    ...snapshot.lines.map((line) => [
      line.sku,
      line.barcode ?? "",
      line.productName,
      line.quantity,
      line.notes ?? ""
    ]),
    [],
    ["Total products", snapshot.lines.length],
    ["Total units", totalUnits]
  ];

  const csv = rows
    .map((row) =>
      row
        .map((cell) => (typeof cell === "number" ? String(cell) : safeCsvText(String(cell))))
        .join(",")
    )
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = supplierFilename(snapshot, "csv");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function printRestockSupplierCopy(snapshot: RestockSupplierSnapshot) {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) {
    return false;
  }

  printWindow.opener = null;
  const totalUnits = snapshot.lines.reduce((sum, line) => sum + line.quantity, 0);
  const rows = snapshot.lines
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.sku)}</td>
          <td>${escapeHtml(line.barcode ?? "—")}</td>
          <td>${escapeHtml(line.productName)}</td>
          <td class="qty">${line.quantity.toLocaleString()}</td>
          <td>${escapeHtml(line.notes?.trim() || "—")}</td>
        </tr>`
    )
    .join("");

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ysabelle Store Restock Order</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { color: #0f172a; font: 12px Arial, sans-serif; margin: 0; }
    h1 { font-size: 21px; margin: 0; }
    h2 { font-size: 13px; margin: 4px 0 0; font-weight: 600; color: #475569; }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
    .meta { display: grid; grid-template-columns: 120px 1fr; gap: 5px 10px; min-width: 330px; }
    .label { color: #64748b; }
    .supplier { border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px 10px; margin-bottom: 14px; }
    .summary { display: flex; gap: 24px; margin: 10px 0 12px; }
    .summary strong { font-size: 16px; }
    table { border-collapse: collapse; width: 100%; }
    thead { display: table-header-group; }
    th { background: #f1f5f9; color: #475569; font-size: 10px; letter-spacing: .05em; text-align: left; text-transform: uppercase; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 8px; vertical-align: top; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .qty { font-weight: 700; text-align: right; white-space: nowrap; }
    .notes { border-top: 1px solid #cbd5e1; margin-top: 16px; padding-top: 10px; white-space: pre-wrap; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 38px; }
    .signature { border-top: 1px solid #475569; padding-top: 6px; text-align: center; color: #475569; }
    .muted { color: #64748b; }
    @media print { .screen-only { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>YSABELLE STORE</h1>
      <h2>RESTOCK ORDER — SUPPLIER COPY</h2>
    </div>
    <div class="meta">
      <span class="label">Reference</span><strong>${escapeHtml(snapshot.orderNumber ?? "Unconfirmed plan")}</strong>
      <span class="label">Status</span><span>${escapeHtml(snapshot.statusLabel)}</span>
      <span class="label">Generated</span><span>${escapeHtml(formatGeneratedAt(snapshot.generatedAt))}</span>
      <span class="label">Prepared by</span><span>${escapeHtml(snapshot.preparedBy ?? "—")}</span>
    </div>
  </div>

  <div class="supplier"><strong>Supplier / Manufacturer:</strong> ________________________________________________</div>

  <div class="summary">
    <div><span class="muted">Products</span><br/><strong>${snapshot.lines.length.toLocaleString()}</strong></div>
    <div><span class="muted">Total units</span><br/><strong>${totalUnits.toLocaleString()}</strong></div>
  </div>

  <table>
    <thead>
      <tr><th>SKU</th><th>Barcode</th><th>Product</th><th>Order quantity</th><th>Item note</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  ${snapshot.notes?.trim() ? `<div class="notes"><strong>Order notes</strong><br/>${escapeHtml(snapshot.notes.trim())}</div>` : ""}

  <div class="signatures">
    <div class="signature">Prepared / Approved by</div>
    <div class="signature">Supplier acknowledgment</div>
  </div>

  <script>window.addEventListener("load", () => window.print());<\/script>
</body>
</html>`);
  printWindow.document.close();
  return true;
}
