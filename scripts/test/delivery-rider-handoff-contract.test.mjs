import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const service = read("backend/src/services/deliveryService.ts");
const storefront = read("backend/src/services/storefrontService.ts");
const prisma = read("database/prisma/schema.prisma");
const migration = read("database/prisma/migrations/0015_rider_handoff_customer_note/migration.sql");
const page = read("frontend/src/pages/DeliveriesPage.tsx");
const account = read("frontend/src/pages/customer/CustomerAccountPage.tsx");
const rider = read("frontend/src/components/customer/OrderRiderInformation.tsx");
const css = read("frontend/src/styles/customer-delivery-handoff.css");

test("Rider fields and distinct public vs internal notes are stored persistently", () => {
  for (const name of ["riderName", "riderPhone", "customerDeliveryNote", "deliveryNotes"])
    assert.ok(prisma.includes(name));
  for (const name of ["rider_name", "rider_phone", "customer_delivery_note"])
    assert.ok(migration.includes(name));
  assert.ok(service.includes("DELIVERY_RIDER_PHONE_REQUIRED"));
  assert.ok(service.includes("INVALID_RIDER_PHONE"));
});
test("Customer response hides staff notes and draft contact before dispatch", () => {
  assert.ok(!storefront.includes("deliveryNotes: order.deliveryNotes"));
  assert.ok(
    storefront.includes('["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.deliveryStatus)')
  );
  assert.ok(!rider.includes("deliveryNotes"));
  assert.ok(rider.includes("navigator.clipboard.writeText"));
});
test("Mobile rider contact is copy-only and dispatch remains safe", () => {
  assert.ok(page.includes("Rider phone number (required to dispatch)"));
  assert.ok(page.includes("Save dispatch draft"));
  assert.ok(page.includes("!riderPhoneValid"));
  assert.ok(account.includes("<OrderRiderInformation order={order} />"));
  assert.match(account, /order\.deliveryStatus\s*===\s*"DELIVERED"[\s\S]*?<OrderRiderInformation/);
  assert.ok(css.includes("@media (max-width: 430px)"));
  assert.ok(css.includes(":root.dark .customer-app"));
  assert.doesNotMatch(rider, /tel:|Call rider/);
  assert.match(rider, /className="customer-rider-handoff__copy"/);
});
