import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { RestockReturnSnapshot } from "@/utils/restockReturnExport";

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila"
});

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}

function addPageNumbers(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Page ${page} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" }
    );
  }
}

export function downloadRestockReturnPdf(snapshot: RestockReturnSnapshot) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const totalReturnUnits = snapshot.lines.reduce((sum, line) => sum + line.returnQuantity, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("YSABELLE STORE", margin, 16);
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text("RETURN REPORT - SUPPLIER COPY", margin, 23);

  const metaX = 118;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Return reference", metaX, 11);
  doc.text("Restock ticket", metaX, 16);
  doc.text("Generated", metaX, 21);
  doc.setTextColor(15, 23, 42);
  doc.text(snapshot.returnReference, 146, 11);
  doc.text(snapshot.orderNumber, 146, 16);
  doc.text(dateTimeFormatter.format(new Date(snapshot.generatedAt)), 146, 21);

  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, 33, pageWidth - margin * 2, 11, 2, 2);
  doc.setFont("helvetica", "bold");
  doc.text("Supplier / Manufacturer:", margin + 3, 40);
  doc.setLineWidth(0.2);
  doc.line(margin + 42, 40.5, pageWidth - margin - 3, 40.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Products to return", margin, 54);
  doc.text("Return units", margin + 42, 54);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(snapshot.lines.length.toLocaleString(), margin, 61);
  doc.text(totalReturnUnits.toLocaleString(), margin + 42, 61);

  autoTable(doc, {
    body: snapshot.lines.map((line) => [
      line.sku,
      line.productName,
      line.deliveredQuantity.toLocaleString(),
      line.damagedQuantity.toLocaleString(),
      line.rejectedQuantity.toLocaleString(),
      line.returnQuantity.toLocaleString(),
      line.damagedQuantity > 0 && line.rejectedQuantity > 0
        ? "Damaged / rejected"
        : line.damagedQuantity > 0
          ? "Damaged on arrival"
          : "Rejected during receiving"
    ]),
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 58 },
      2: { cellWidth: 20, halign: "right" },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 20, halign: "right" },
      5: { cellWidth: 22, fontStyle: "bold", halign: "right" },
      6: { cellWidth: 27 }
    },
    head: [["SKU", "Product", "Delivered", "Damaged", "Rejected", "Return qty", "Reason"]],
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105] },
    margin: { bottom: 20, left: margin, right: margin },
    startY: 69,
    styles: { cellPadding: 2.4, fontSize: 7.4, lineColor: [203, 213, 225], lineWidth: 0.15 },
    theme: "grid"
  });

  const tableState = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  let signatureY = (tableState.lastAutoTable?.finalY ?? 69) + 28;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (signatureY > pageHeight - 24) {
    doc.addPage();
    signatureY = 34;
  }

  doc.setDrawColor(71, 85, 105);
  doc.line(margin, signatureY, 89, signatureY);
  doc.line(120, signatureY, pageWidth - margin, signatureY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Store representative", 50, signatureY + 5, { align: "center" });
  doc.text("Supplier acknowledgment", 159, signatureY + 5, { align: "center" });

  addPageNumbers(doc);
  doc.save(`ysabelle-return-${safeFilename(snapshot.returnReference)}.pdf`);
}
