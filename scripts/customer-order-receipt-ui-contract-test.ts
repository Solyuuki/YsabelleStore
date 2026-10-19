import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildCustomerOrderReceipt,
  createCustomerOrderReceiptPdf,
  customerOrderReceiptHtml,
  receiptFileName
} from "../frontend/src/utils/customerOrderReceipt";
import type { StorefrontOrder } from "../frontend/src/types/storefront";

const account = readFileSync(
  resolve(process.cwd(), "src/pages/customer/CustomerAccountPage.tsx"),
  "utf8"
);
const css = readFileSync(resolve(process.cwd(), "src/styles/customer-account-premium.css"), "utf8");
const example = {
  id: "test-1",
  orderNumber: "YS-20261016-5EC2FF",
  deliveryTicketNumber: "DEL-YS-20261016-5EC2FF",
  deliveryStatus: "DELIVERED",
  createdAt: "2026-10-16T11:52:00.000Z",
  deliveredAt: "2026-10-16T12:20:00.000Z",
  paymentMethod: "CASH_ON_DELIVERY",
  paymentStatus: "PAID",
  totalAmount: "81.00",
  items: [
    {
      productId: "a",
      productName: "Active Bottle",
      quantity: 1,
      unitPrice: "25.00",
      totalAmount: "25.00"
    },
    {
      productId: "b",
      productName: "Isotonic Drink",
      quantity: 1,
      unitPrice: "26.00",
      totalAmount: "26.00"
    },
    {
      productId: "c",
      productName: "<script>alert('x')</script>",
      quantity: 1,
      unitPrice: "30.00",
      totalAmount: "30.00"
    }
  ]
} as StorefrontOrder;

const receipt = buildCustomerOrderReceipt(example);
assert.equal(receipt.total, 81);
assert.equal(receipt.items.length, 3);
assert.equal(receipt.paymentMethod, "Cash on Delivery");
assert.equal(receipt.paymentStatus, "PAID");
assert.equal(receiptFileName("../dangerous name"), "Ysabelle-Order----dangerous-name.pdf");
const html = customerOrderReceiptHtml(example);
assert.ok(html.includes("81.00"));
assert.ok(html.includes("Not a BIR-registered VAT invoice"));
assert.ok(html.includes("&lt;script&gt;"));
assert.ok(!html.includes("<script>alert"));
assert.throws(
  () => buildCustomerOrderReceipt({ ...example, deliveryStatus: "CANCELLED" }),
  /delivered orders/
);
assert.match(account, /className="customer-account-history-card__amount"/);
assert.match(account, /<small>Total<\/small>/);
assert.match(account, /className="customer-account-history-card__total"/);
assert.match(account, /handlePrintReceipt\(order\)/);
assert.match(account, /handleDownloadReceipt\(order\)/);
assert.match(account, /order.deliveryStatus === "DELIVERED"/);
assert.match(css, /\.customer-account-history-card__receipt-actions button/);
assert.match(css, /\.customer-account-history-card__amount/);
assert.match(css, /@media \(max-width: 720px\)/);
const pdf = await createCustomerOrderReceiptPdf(example);
const binary = new Uint8Array(pdf.output("arraybuffer"));
assert.equal(String.fromCharCode(...binary.slice(0, 4)), "%PDF");
assert.ok(binary.length > 1000, "Expected a nonempty customer PDF.");

console.log("Customer order receipt and responsive order history contract passed.");
