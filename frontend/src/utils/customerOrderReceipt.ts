import type { StorefrontOrder } from "@/types/storefront";

const receiptDate = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short"
});
const php = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const printablePhp = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function receiptFileName(orderNumber: string) {
  const safeReference = orderNumber.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 72) || "order";
  return "Ysabelle-Order-" + safeReference + ".pdf";
}

export function escapeReceiptHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildCustomerOrderReceipt(order: StorefrontOrder) {
  if (order.deliveryStatus !== "DELIVERED") {
    throw new Error("A receipt is available only for delivered orders.");
  }
  if (!Number.isFinite(Number(order.totalAmount)) || Number(order.totalAmount) < 0) {
    throw new Error("The order total is invalid.");
  }
  const items = order.items.map((item) => {
    const numericFields = [item.quantity, Number(item.unitPrice), Number(item.totalAmount)];
    if (numericFields.some((number) => !Number.isFinite(number) || number < 0)) {
      throw new Error("The order contains invalid item amounts.");
    }
    return {
      name: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.totalAmount)
    };
  });
  return {
    orderNumber: order.orderNumber,
    ticketNumber: order.deliveryTicketNumber,
    orderedAt: receiptDate.format(new Date(order.createdAt)),
    deliveredAt: order.deliveredAt ? receiptDate.format(new Date(order.deliveredAt)) : null,
    paymentMethod:
      order.paymentMethod === "CASH_ON_DELIVERY" ? "Cash on Delivery" : "PayMongo",
    paymentStatus: order.paymentStatus,
    items,
    total: Number(order.totalAmount)
  };
}

export function customerOrderReceiptHtml(order: StorefrontOrder): string {
  const receipt = buildCustomerOrderReceipt(order);
  const safe = escapeReceiptHtml;
  const money = (amount: number) => safe(php.format(amount));
  const rows = receipt.items
    .map((item) =>
      [
        "<tr><td>",
        safe(item.name),
        "</td><td class='num'>",
        item.quantity,
        "</td><td class='num'>",
        money(item.unitPrice),
        "</td><td class='num'>",
        money(item.lineTotal),
        "</td></tr>"
      ].join("")
    )
    .join("");
  return [
    "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
    "<meta name='viewport' content='width=device-width,initial-scale=1'>",
    "<title>Ysabelle Store - " + safe(receipt.orderNumber) + "</title>",
    "<style>",
    "body{font:14px Arial,sans-serif;color:#172033;max-width:760px;margin:28px auto;padding:0 18px}",
    "h1{font-size:22px;margin:0}h2{font-size:15px;font-weight:500;color:#43506a}",
    ".ref{margin-top:18px;padding:12px;border:1px solid #ddd;border-radius:6px}",
    ".ref p{margin:5px 0;overflow-wrap:anywhere}",
    "table{width:100%;border-collapse:collapse;margin-top:18px}",
    "th,td{padding:9px 6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}",
    ".num{text-align:right;white-space:nowrap}",
    ".total{display:flex;justify-content:space-between;border-top:2px solid #172033;padding-top:14px;margin-top:16px;font-weight:700;font-size:18px}",
    ".note{font-size:11px;color:#555;margin-top:22px}",
    "@page{size:A4;margin:14mm}@media print{body{margin:0;max-width:none;padding:0}tr{break-inside:avoid}}",
    "</style></head><body>",
    "<h1>Ysabelle Store</h1><h2>Customer order receipt</h2>",
    "<div class='ref'><p><strong>Order:</strong> " + safe(receipt.orderNumber) + "</p>",
    "<p><strong>Delivery ticket:</strong> " + safe(receipt.ticketNumber) + "</p>",
    "<p><strong>Ordered:</strong> " + safe(receipt.orderedAt) + "</p>",
    receipt.deliveredAt
      ? "<p><strong>Delivered:</strong> " + safe(receipt.deliveredAt) + "</p>"
      : "",
    "<p><strong>Payment:</strong> " +
      safe(receipt.paymentMethod) +
      " (" +
      safe(receipt.paymentStatus) +
      ")</p></div>",
    "<table><thead><tr><th>Product</th><th class='num'>Qty</th><th class='num'>Unit</th>",
    "<th class='num'>Amount</th></tr></thead><tbody>" + rows + "</tbody></table>",
    "<div class='total'><span>Order total</span><span>" + money(receipt.total) + "</span></div>",
    "<p class='note'>Customer order summary only. Not a BIR-registered VAT invoice. ",
    "Payment status is shown as recorded by the store.</p>",
    "</body></html>"
  ].join("");
}

export function printCustomerOrderReceipt(order: StorefrontOrder): void {
  // Open during the click event to avoid popup blockers.
  const popup = window.open("", "_blank", "width=840,height=760");
  if (!popup) {
    throw new Error("Your browser blocked the receipt window. Allow pop-ups to print.");
  }
  try {
    popup.document.open();
    popup.document.write(customerOrderReceiptHtml(order));
    popup.document.close();
    // Print exactly once, whether the popup has loaded already or loads later.
    const triggerPrint = () => {
      popup.focus();
      popup.print();
    };
    if (popup.document.readyState === "complete") {
      triggerPrint();
    } else {
      popup.addEventListener("load", triggerPrint, { once: true });
    }
  } catch (error) {
    popup.close();
    throw error;
  }
}

export async function createCustomerOrderReceiptPdf(order: StorefrontOrder) {
  const receipt = buildCustomerOrderReceipt(order);
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ format: "a4", unit: "mm" });
  const left = 17;
  const right = 193;
  let y = 22;
  const money = (amount: number) => "PHP " + printablePhp.format(amount);
  const line = (label: string, value: string) => {
    document.setFont("helvetica", "normal");
    document.setFontSize(10);
    document.text(label, left, y);
    document.text(value, right, y, { align: "right" });
    y += 7;
  };
  const newPage = () => {
    document.addPage();
    y = 22;
  };
  document.setTextColor(28, 35, 54);
  document.setFont("helvetica", "bold");
  document.setFontSize(20);
  document.text("Ysabelle Store", left, y);
  y += 10;
  document.setFont("helvetica", "normal");
  document.setFontSize(12);
  document.text("Customer order receipt", left, y);
  y += 12;
  // Wrap dynamic references; never clip or invent invoice information.
  const detail = (label: string, value: string) => {
    const lines = document.splitTextToSize(label + ": " + value, 170) as string[];
    document.setFontSize(10);
    for (const part of lines) {
      if (y > 270) newPage();
      document.text(part, left, y);
      y += 6;
    }
  };
  detail("Order", receipt.orderNumber);
  detail("Delivery ticket", receipt.ticketNumber);
  detail("Ordered", receipt.orderedAt);
  if (receipt.deliveredAt) detail("Delivered", receipt.deliveredAt);
  detail("Payment", receipt.paymentMethod + " - " + receipt.paymentStatus);
  y += 5;
  document.setDrawColor(180, 185, 200);
  document.line(left, y, right, y);
  y += 8;
  receipt.items.forEach((item) => {
    const productLines = document.splitTextToSize(item.name, 94) as string[];
    const rowHeight = Math.max(9, productLines.length * 5 + 3);
    if (y + rowHeight > 260) newPage();
    document.setFont("helvetica", "normal");
    document.setFontSize(10);
    document.text(productLines, left, y);
    document.text(String(item.quantity) + " x " + money(item.unitPrice), 140, y, {
      align: "right"
    });
    document.text(money(item.lineTotal), right, y, { align: "right" });
    y += rowHeight;
    document.setDrawColor(222, 225, 233);
    document.line(left, y - 2, right, y - 2);
  });
  if (y > 245) newPage();
  y += 8;
  document.setFont("helvetica", "bold");
  document.setFontSize(13);
  line("Order total", money(receipt.total));
  y += 8;
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.text("Customer order summary only. Not a BIR-registered VAT invoice.", left, y);
  y += 5;
  document.text("Payment status is shown as recorded by the store.", left, y);
  return document;
}

export async function downloadCustomerOrderReceipt(order: StorefrontOrder): Promise<void> {
  const document = await createCustomerOrderReceiptPdf(order);
  document.save(receiptFileName(order.orderNumber));
}
