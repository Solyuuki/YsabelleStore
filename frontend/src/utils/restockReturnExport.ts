import type { RestockOrder } from "@/services/restockApi";

export type RestockReturnLine = {
  acceptedQuantity: number;
  barcode: string | null;
  damagedQuantity: number;
  damageReason: string | null;
  deliveredQuantity: number;
  productName: string;
  rejectedQuantity: number;
  returnQuantity: number;
  sku: string;
};

export type RestockReturnDocumentInfo = {
  createdAt?: string;
  deliveryReference?: string;
  supplierName?: string;
};

export type RestockReturnStoredInfo = {
  createdAt: string;
  deliveryReference: string;
  supplierName: string;
};

export type RestockReturnSnapshot = {
  deliveryReference: string;
  generatedAt: string;
  orderNumber: string;
  returnReference: string;
  returnScope: "Damaged items only" | "Entire delivery";
  supplierName: string;
  lines: RestockReturnLine[];
};

const generatedAtFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila"
});

const RETURN_REPORT_MARKER_PATTERN = /\[ReturnReport ([^\]]+)\]/g;

const RECEIPT_EVENT_PATTERN =
  /\[Receipt [^\]]+\]\s+delivered=(\d+)\s+damaged=(\d+)\s+accepted=(\d+)\s+other_rejected=(\d+)(?:\s+damage_reason=([^\s]+))?/g;

function safeCsvText(value: string) {
  const normalized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${normalized.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reportFilename(snapshot: RestockReturnSnapshot, extension: string) {
  const safeReference = snapshot.returnReference
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `ysabelle-return-${safeReference || "report"}.${extension}`;
}

function aggregateReceiptNotes(notes: string | null) {
  const totals = {
    acceptedQuantity: 0,
    damagedQuantity: 0,
    deliveredQuantity: 0,
    rejectedQuantity: 0,
    damageReason: null as string | null
  };

  if (!notes) return totals;

  for (const match of notes.matchAll(RECEIPT_EVENT_PATTERN)) {
    totals.deliveredQuantity += Number(match[1] ?? 0);
    totals.damagedQuantity += Number(match[2] ?? 0);
    totals.acceptedQuantity += Number(match[3] ?? 0);
    totals.rejectedQuantity += Number(match[4] ?? 0);
    if (match[5]) {
      try {
        const decoded = decodeURIComponent(match[5]);
        totals.damageReason = totals.damageReason ? `${totals.damageReason}; ${decoded}` : decoded;
      } catch {
        totals.damageReason = totals.damageReason ?? "Damage recorded during receiving";
      }
    }
  }

  return totals;
}

export function getRestockReturnDocumentInfo(order: RestockOrder): RestockReturnStoredInfo {
  const matches = [...(order.notes ?? "").matchAll(RETURN_REPORT_MARKER_PATTERN)];
  const encoded = matches.length > 0 ? matches[matches.length - 1]?.[1] : undefined;

  if (encoded) {
    try {
      const parsed = JSON.parse(decodeURIComponent(encoded)) as Partial<RestockReturnStoredInfo>;
      if (typeof parsed.createdAt === "string") {
        return {
createdAt: parsed.createdAt,
deliveryReference:
  typeof parsed.deliveryReference === "string" ? parsed.deliveryReference : "",
supplierName: typeof parsed.supplierName === "string" ? parsed.supplierName : ""
        };
      }
    } catch {
      // Fall through to the delivery timestamp for legacy damaged tickets.
    }
  }

  return {
    createdAt: order.updatedAt ?? order.approvedAt ?? order.createdAt,
    deliveryReference: "",
    supplierName: ""
  };
}

export function buildRestockReturnSnapshot(
  order: RestockOrder,
  documentInfo: RestockReturnDocumentInfo = {}
): RestockReturnSnapshot | null {
  const lines = order.lines
    .filter((line) => line.isSelected)
    .map((line) => {
      const receipt = aggregateReceiptNotes(line.notes ?? null);
      const returnQuantity = receipt.damagedQuantity + receipt.rejectedQuantity;

      return {
        ...receipt,
        barcode: line.product.barcode,
        productName: line.product.name,
        returnQuantity,
        sku: line.product.sku
      } satisfies RestockReturnLine;
    })
    .filter((line) => line.returnQuantity > 0);

  if (lines.length === 0) return null;

  const selectedLineCount = order.lines.filter((line) => line.isSelected).length;
  const returnScope =
    lines.length === selectedLineCount &&
    lines.every(
      (line) => line.deliveredQuantity > 0 && line.returnQuantity === line.deliveredQuantity
    )
      ? "Entire delivery"
      : "Damaged items only";

  return {
    deliveryReference: documentInfo.deliveryReference?.trim() ?? "",
    generatedAt: documentInfo.createdAt ?? new Date().toISOString(),
    lines,
    orderNumber: order.orderNumber,
    returnReference: `RETURN-${order.orderNumber.replace(/^RO-/, "")}`,
    returnScope,
    supplierName: documentInfo.supplierName?.trim() ?? ""
  };
}

export function hasRestockReturnItems(order: RestockOrder) {
  return buildRestockReturnSnapshot(order) !== null;
}

export function downloadRestockReturnCsv(snapshot: RestockReturnSnapshot) {
  const totalReturnUnits = snapshot.lines.reduce((sum, line) => sum + line.returnQuantity, 0);
  const rows: Array<Array<string | number>> = [
    ["YSABELLE STORE", "RETURN REPORT - SUPPLIER COPY"],
    ["Return reference", snapshot.returnReference],
    ["Restock ticket", snapshot.orderNumber],
    ["Supplier / Manufacturer", snapshot.supplierName],
    ["Delivery / Invoice reference", snapshot.deliveryReference],
    ["Return scope", snapshot.returnScope],
    ["Generated", generatedAtFormatter.format(new Date(snapshot.generatedAt))],
    [],
    [
      "SKU",
      "Barcode",
      "Product",
      "Delivered",
      "Accepted",
      "Damaged",
      "Other rejected",
      "Return quantity",
      "Reason"
    ],
    ...snapshot.lines.map((line) => [
      line.sku,
      line.barcode ?? "",
      line.productName,
      line.deliveredQuantity,
      line.acceptedQuantity,
      line.damagedQuantity,
      line.rejectedQuantity,
      line.returnQuantity,
      line.damageReason ??
        (line.damagedQuantity > 0 && line.rejectedQuantity > 0
          ? "Damaged / rejected during receiving"
          : line.damagedQuantity > 0
            ? "Damaged on arrival"
            : "Rejected during receiving")
    ]),
    [],
    ["Total products", snapshot.lines.length],
    ["Total return units", totalReturnUnits]
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
  anchor.download = reportFilename(snapshot, "csv");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function printRestockReturnCopy(snapshot: RestockReturnSnapshot) {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) return false;

  printWindow.opener = null;
  printWindow.addEventListener("load", () => printWindow.print(), { once: true });

  const totalReturnUnits = snapshot.lines.reduce((sum, line) => sum + line.returnQuantity, 0);
  const rows = snapshot.lines
    .map((line) => {
      const reason =
        line.damageReason ??
        (line.damagedQuantity > 0 && line.rejectedQuantity > 0
          ? "Damaged / rejected"
          : line.damagedQuantity > 0
            ? "Damaged on arrival"
            : "Rejected during receiving");
      return `<tr>
        <td>${escapeHtml(line.sku)}</td>
        <td>${escapeHtml(line.productName)}</td>
        <td class="qty">${line.deliveredQuantity.toLocaleString()}</td>
        <td class="qty">${line.damagedQuantity.toLocaleString()}</td>
        <td class="qty">${line.rejectedQuantity.toLocaleString()}</td>
        <td class="qty strong">${line.returnQuantity.toLocaleString()}</td>
        <td>${escapeHtml(reason)}</td>
      </tr>`;
    })
    .join("");

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ysabelle Store Return Report</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { color: #0f172a; font: 12px Arial, sans-serif; margin: 0; }
    h1 { font-size: 21px; margin: 0; }
    h2 { color: #475569; font-size: 13px; font-weight: 600; margin: 4px 0 0; }
    .header { display: flex; gap: 24px; justify-content: space-between; margin-bottom: 18px; }
    .meta { display: grid; gap: 5px 10px; grid-template-columns: 110px 1fr; min-width: 330px; }
    .label, .muted { color: #64748b; }
    .supplier { border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 14px; padding: 9px 10px; }
    .summary { display: flex; gap: 24px; margin: 10px 0 12px; }
    .summary strong { font-size: 16px; }
    table { border-collapse: collapse; width: 100%; }
    thead { display: table-header-group; }
    th { background: #f1f5f9; color: #475569; font-size: 9px; letter-spacing: .04em; text-align: left; text-transform: uppercase; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 8px; vertical-align: top; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .qty { text-align: right; white-space: nowrap; }
    .strong { font-weight: 700; }
    .signatures { display: grid; gap: 48px; grid-template-columns: 1fr 1fr; margin-top: 38px; }
    .signature { border-top: 1px solid #475569; color: #475569; padding-top: 6px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div><h1>YSABELLE STORE</h1><h2>RETURN REPORT — SUPPLIER COPY</h2></div>
    <div class="meta">
      <span class="label">Return reference</span><strong>${escapeHtml(snapshot.returnReference)}</strong>
      <span class="label">Restock ticket</span><span>${escapeHtml(snapshot.orderNumber)}</span>
      <span class="label">Generated</span><span>${escapeHtml(generatedAtFormatter.format(new Date(snapshot.generatedAt)))}</span>
      <span class="label">Return scope</span><span>${escapeHtml(snapshot.returnScope)}</span>
    </div>
  </div>
  <div class="supplier"><strong>Supplier / Manufacturer:</strong> ${escapeHtml(snapshot.supplierName || "Not provided")}<br/><span class="muted">Delivery / Invoice reference:</span> ${escapeHtml(snapshot.deliveryReference || "Not provided")}</div>
  <div class="summary">
    <div><span class="muted">Products to return</span><br/><strong>${snapshot.lines.length.toLocaleString()}</strong></div>
    <div><span class="muted">Return units</span><br/><strong>${totalReturnUnits.toLocaleString()}</strong></div>
  </div>
  <table>
    <thead><tr><th>SKU</th><th>Product</th><th>Delivered</th><th>Damaged</th><th>Rejected</th><th>Return qty</th><th>Reason</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="signatures">
    <div class="signature">Store representative</div>
    <div class="signature">Supplier acknowledgment</div>
  </div>
</body>
</html>`);
  printWindow.document.close();
  return true;
}
