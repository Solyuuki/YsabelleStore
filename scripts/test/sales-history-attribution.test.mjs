import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const salesService = read("backend/src/services/posService.ts");
const moderation = read("backend/src/services/customerModerationService.ts");
const salesPage = read("frontend/src/pages/SalesPage.tsx");
const salesMobile = read("frontend/src/components/sales/SalesMobileReceiptDetails.tsx");
const receipt = read("frontend/src/components/receipt/RetailReceipt.tsx");
const attribution = read("frontend/src/utils/saleAttribution.ts");
const schema = read("database/prisma/schema.prisma");

test("WEB sale attribution retains the original customer order snapshot after account bans", () => {
  assert.match(schema, /customerName\s+String\s+@map\("customer_name"\)/);
  assert.match(salesService, /customerOrder: \{ select: \{ customerName: true \} \}/);
  assert.match(salesService, /customerName: sale\.customerOrder\?\.customerName \?\? null/);
  assert.match(salesService, /sale\.saleNumber\.startsWith\("WEB-"\)/);
  assert.match(moderation, /data: \{ status: input\.status \}/);
});

test("WEB sales show Customer instead of Unassigned cashier in all receipt surfaces", () => {
  assert.match(attribution, /label: "Customer"/);
  assert.match(attribution, /sale\.customerName\?\.trim\(\)/);
  assert.match(attribution, /sale\.cashierName\?\.trim\(\)/);
  assert.match(salesPage, /const attribution = getSaleAttribution\(sale\);/);
  assert.match(salesPage, /selectedAttribution\?\.label/);
  assert.match(salesMobile, /getSaleAttribution\(sale\)/);
  assert.match(receipt, /receipt\.saleSource === "WEB"/);
  assert.match(receipt, /receipt\.customerName\?\.trim\(\)/);
  assert.doesNotMatch(salesPage, /Unassigned cashier/);
  assert.doesNotMatch(salesMobile, /Unassigned cashier/);
});
