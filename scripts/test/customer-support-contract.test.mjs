import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [routeIndex, supportRoutes, supportService, customerApp, supportPage, footer] =
  await Promise.all([
    readFile(new URL("../../backend/src/routes/index.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../backend/src/routes/customerSupport.routes.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../../backend/src/services/customerSupportService.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../../frontend/src/app/CustomerApp.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../../frontend/src/pages/customer/CustomerSupportPage.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../../frontend/src/components/customer/CustomerFooter.tsx", import.meta.url),
      "utf8"
    )
  ]);

test("customer support API is mounted and creates ticket references", () => {
  assert.match(routeIndex, /router\.use\("\/customer-support", customerSupportRouter\)/);
  assert.match(supportRoutes, /customerSupportRouter\.post\(\s*"\/tickets"/);
  assert.match(supportRoutes, /optionalCustomerAuth/);
  assert.match(supportRoutes, /CUSTOMER_SUPPORT_RATE_LIMITED/);
  assert.match(supportService, /YS-CS-/);
  assert.match(supportService, /senderType: "CUSTOMER"/);
  assert.match(supportService, /senderType: "SYSTEM"/);
});

test("customer storefront exposes the support page, form, FAQ and footer entry", () => {
  assert.match(customerApp, /pathname === "\/support"/);
  assert.match(customerApp, /CustomerSupportPage/);
  assert.match(supportPage, /Submit support request/);
  assert.match(supportPage, /Frequently asked questions/);
  assert.match(supportPage, /createdTicket\.ticketNumber/);
  assert.match(footer, /href="\/support"/);
  assert.match(footer, /Customer Support/);
});
