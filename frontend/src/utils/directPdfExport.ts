import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { InternalReportSnapshot } from "@/utils/reportExport";
import type { RestockSupplierSnapshot } from "@/utils/restockExport";

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila"
});

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

function generatedLabel(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function money(value: string | number) {
  return `PHP ${moneyFormatter.format(Number(value))}`;
}

function fileDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function supplierFilename(snapshot: RestockSupplierSnapshot) {
  const reference = snapshot.orderNumber?.trim() || "restock-plan";
  const safeReference = reference.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `ysabelle-restock-${safeReference || "plan"}.pdf`;
}

function addPageNumber(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${page} of ${pages}`, width - 14, height - 8, { align: "right" });
  }
}

function drawMetric(doc: jsPDF, x: number, y: number, width: number, label: string, value: string) {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, width, 18, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(label.toUpperCase(), x + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(value, x + 4, y + 14);
}

export function downloadOperationalSummaryPdf(snapshot: InternalReportSnapshot) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const gap = 4;
  const metricWidth = (pageWidth - margin * 2 - gap * 3) / 4;
  const summary = snapshot.summary;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(15, 23, 42);
  doc.text("YSABELLE STORE", margin, 18);
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text("OPERATIONAL SUMMARY", margin, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated ${generatedLabel(summary.generatedAt)}`, margin, 31);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Sales overview", margin, 44);
  drawMetric(doc, margin, 48, metricWidth, "Today's sales", money(summary.sales.todayAmount));
  drawMetric(
    doc,
    margin + (metricWidth + gap),
    48,
    metricWidth,
    "Recent gross",
    money(recentGross(snapshot))
  );
  drawMetric(
    doc,
    margin + (metricWidth + gap) * 2,
    48,
    metricWidth,
    "Receipts",
    snapshot.completedSales.length.toLocaleString()
  );
  drawMetric(
    doc,
    margin + (metricWidth + gap) * 3,
    48,
    metricWidth,
    "Units sold",
    recentUnits(snapshot).toLocaleString()
  );

  doc.text("Inventory overview", margin, 80);
  drawMetric(
    doc,
    margin,
    84,
    metricWidth,
    "Tracked products",
    summary.inventory.trackedItems.toLocaleString()
  );
  drawMetric(
    doc,
    margin + (metricWidth + gap),
    84,
    metricWidth,
    "Units on hand",
    totalUnitsOnHand(snapshot).toLocaleString()
  );
  drawMetric(
    doc,
    margin + (metricWidth + gap) * 2,
    84,
    metricWidth,
    "Low stock",
    summary.inventory.lowStockItems.toLocaleString()
  );
  drawMetric(
    doc,
    margin + (metricWidth + gap) * 3,
    84,
    metricWidth,
    "Out of stock",
    summary.inventory.outOfStockItems.toLocaleString()
  );

  const inventoryHealthy =
    summary.inventory.lowStockItems === 0 && summary.inventory.outOfStockItems === 0;
  const expiryHealthy =
    summary.expiry.nearExpiryBatches === 0 && summary.expiry.expiredBatches === 0;
  autoTable(doc, {
    body: [
      [
        "Inventory status",
        inventoryHealthy
          ? "No low-stock or out-of-stock products need attention."
          : "Inventory has products that need replenishment attention."
      ],
      [
        "Expiry status",
        expiryHealthy
          ? "No expiry issues need attention right now."
          : `${summary.expiry.nearExpiryBatches.toLocaleString()} near-expiry and ${summary.expiry.expiredBatches.toLocaleString()} expired batches need review.`
      ]
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: "auto" }
    },
    margin: { left: margin, right: margin },
    startY: 114,
    styles: { cellPadding: 4, fontSize: 9, lineColor: [226, 232, 240], lineWidth: 0.2 },
    theme: "grid"
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Management summary only. Use Inventory Report for product-level stock rows and Restock / Supplier Order for supplier-facing quantities.",
    margin,
    151,
    { maxWidth: pageWidth - margin * 2 }
  );

  addPageNumber(doc);
  doc.save(`ysabelle-operational-summary-${fileDate(summary.generatedAt)}.pdf`);
}

export function downloadInventoryReportPdf(snapshot: InternalReportSnapshot) {
  const doc = new jsPDF({ format: "a4", orientation: "landscape", unit: "mm" });
  const summary = snapshot.summary;
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const gap = 3;
  const metricWidth = (pageWidth - margin * 2 - gap * 5) / 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("YSABELLE STORE - INVENTORY REPORT", margin, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated ${generatedLabel(summary.generatedAt)}`, margin, 21);

  drawMetric(
    doc,
    margin,
    27,
    metricWidth,
    "Tracked products",
    summary.inventory.trackedItems.toLocaleString()
  );
  drawMetric(
    doc,
    margin + (metricWidth + gap),
    27,
    metricWidth,
    "Units on hand",
    totalUnitsOnHand(snapshot).toLocaleString()
  );
  drawMetric(
    doc,
    margin + (metricWidth + gap) * 2,
    27,
    metricWidth,
    "Active products",
    summary.inventory.availableItems.toLocaleString()
  );
  drawMetric(
    doc,
    margin + (metricWidth + gap) * 3,
    27,
    metricWidth,
    "Inactive / stopped",
    summary.inventory.unavailableItems.toLocaleString()
  );
  drawMetric(
    doc,
    margin + (metricWidth + gap) * 4,
    27,
    metricWidth,
    "Low stock",
    summary.inventory.lowStockItems.toLocaleString()
  );
  drawMetric(
    doc,
    margin + (metricWidth + gap) * 5,
    27,
    metricWidth,
    "Out of stock",
    summary.inventory.outOfStockItems.toLocaleString()
  );

  autoTable(doc, {
    body: snapshot.inventory.map((item) => [
      item.sku,
      item.productName,
      item.status,
      item.stockStatus.replaceAll("_", " "),
      item.currentQuantity.toLocaleString(),
      item.availableQuantity.toLocaleString(),
      item.reorderLevel.toLocaleString(),
      item.targetStockLevel.toLocaleString()
    ]),
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 68 },
      2: { cellWidth: 27 },
      3: { cellWidth: 30 },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 22, halign: "right" }
    },
    head: [
      [
        "SKU",
        "Product",
        "Product status",
        "Stock status",
        "On hand",
        "Available",
        "Reorder",
        "Target"
      ]
    ],
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105] },
    margin: { bottom: 14, left: margin, right: margin },
    startY: 51,
    styles: { cellPadding: 2.2, fontSize: 7.5, lineColor: [203, 213, 225], lineWidth: 0.15 },
    theme: "grid"
  });

  addPageNumber(doc);
  doc.save(`ysabelle-inventory-report-${fileDate(summary.generatedAt)}.pdf`);
}

export function downloadRestockSupplierPdf(snapshot: RestockSupplierSnapshot) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const totalUnits = snapshot.lines.reduce((sum, line) => sum + line.quantity, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("YSABELLE STORE", margin, 16);
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text("RESTOCK ORDER - SUPPLIER COPY", margin, 23);

  const metaX = 126;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Reference", metaX, 11);
  doc.text("Status", metaX, 16);
  doc.text("Generated", metaX, 21);
  doc.text("Prepared by", metaX, 26);
  doc.setTextColor(15, 23, 42);
  doc.text(snapshot.orderNumber ?? "Unconfirmed plan", 151, 11);
  doc.text(snapshot.statusLabel, 151, 16);
  doc.text(generatedLabel(snapshot.generatedAt), 151, 21);
  doc.text(snapshot.preparedBy ?? "-", 151, 26);

  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, 34, pageWidth - margin * 2, 11, 2, 2);
  doc.setFont("helvetica", "bold");
  doc.text("Supplier / Manufacturer:", margin + 3, 41);
  doc.setLineWidth(0.2);
  doc.line(margin + 42, 41.5, pageWidth - margin - 3, 41.5);

  drawMetric(doc, margin, 50, 40, "Products", snapshot.lines.length.toLocaleString());
  drawMetric(doc, margin + 44, 50, 40, "Total units", totalUnits.toLocaleString());

  autoTable(doc, {
    body: snapshot.lines.map((line) => [
      line.sku,
      line.barcode ?? "-",
      line.productName,
      line.quantity.toLocaleString(),
      line.notes?.trim() || "-"
    ]),
    columnStyles: {
      0: { cellWidth: 27 },
      1: { cellWidth: 34 },
      2: { cellWidth: 67 },
      3: { cellWidth: 27, fontStyle: "bold", halign: "right" },
      4: { cellWidth: 31 }
    },
    head: [["SKU", "Barcode", "Product", "Order quantity", "Item note"]],
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105] },
    margin: { bottom: 20, left: margin, right: margin },
    startY: 73,
    styles: { cellPadding: 2.4, fontSize: 7.7, lineColor: [203, 213, 225], lineWidth: 0.15 },
    theme: "grid"
  });

  const tableState = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  let contentY = (tableState.lastAutoTable?.finalY ?? 73) + 7;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (contentY > pageHeight - 45) {
    doc.addPage();
    contentY = 18;
  }

  if (snapshot.notes?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("Order notes", margin, contentY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(snapshot.notes.trim(), pageWidth - margin * 2);
    doc.text(noteLines, margin, contentY + 5);
    contentY += Math.min(noteLines.length * 4, 24) + 8;
  }

  if (contentY > pageHeight - 28) {
    doc.addPage();
    contentY = 24;
  }
  const signatureY = Math.max(contentY + 15, pageHeight - 28);
  doc.setDrawColor(71, 85, 105);
  doc.line(margin, signatureY, 90, signatureY);
  doc.line(120, signatureY, pageWidth - margin, signatureY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Prepared / Approved by", 51, signatureY + 5, { align: "center" });
  doc.text("Supplier acknowledgment", 159, signatureY + 5, { align: "center" });

  addPageNumber(doc);
  doc.save(supplierFilename(snapshot));
}
