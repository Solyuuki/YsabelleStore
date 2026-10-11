import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("delivery archive has explicit active, history and all filters", () => {
  const validators = read("backend/src/validators/delivery.validators.ts");
  const service = read("backend/src/services/deliveryService.ts");
  const page = read("frontend/src/pages/DeliveriesPage.tsx");

  assert.match(validators, /view: z\.enum\(\["active", "history", "all"\]\)/);
  assert.match(service, /deliveryViewWhere\(query\.view\)/);
  assert.match(service, /CustomerDeliveryStatus\.CANCELLED/);
  assert.match(service, /CustomerDeliveryStatus\.DELIVERED/);
  assert.match(service, /paymentStatus: \{ not: CustomerPaymentStatus\.PAID \}/);
  assert.match(page, /setView\(nextView\)/);
  assert.match(page, /meta\.counts\[nextView\]/);
  assert.match(page, /setStatus\("all"\)/);
});

test("queue fetch is paginated and does not load complete ticket timelines", () => {
  const service = read("backend/src/services/deliveryService.ts");
  const routes = read("backend/src/routes/delivery.routes.ts");
  const page = read("frontend/src/pages/DeliveriesPage.tsx");
  const api = read("frontend/src/services/deliveryApi.ts");
  const list = service.slice(
    service.indexOf("export async function listDeliveryTickets("),
    service.indexOf("export async function getDeliveryTicket(")
  );

  assert.match(list, /const page = totalPages === 0 \? 1 : Math\.min\(query\.page, totalPages\)/);
  assert.match(list, /skip: \(page - 1\) \* query\.pageSize/);
  assert.match(list, /select: \{/);
  assert.doesNotMatch(list, /include: deliveryOrderInclude/);
  assert.match(routes, /deliveryRouter\.get\("\/:orderId", requireRole\("OWNER", "STAFF"\), getDeliveryTicketController\)/);
  assert.match(api, /apiClient\.request<DeliveryTicketSummary\[\], never, DeliveryListMeta>/);
  assert.match(page, /setSelected\(await getDeliveryTicket\(ticketId\)\)/);
  assert.match(page, /Ticket activity history/);
  assert.match(page, /selected\.timeline\.map/);
});

test("history uses durable records without deleting stock, orders, or sale data", () => {
  const service = read("backend/src/services/deliveryService.ts");
  const page = read("frontend/src/pages/DeliveriesPage.tsx");
  const detail = service.slice(
    service.indexOf("export async function getDeliveryTicket("),
    service.indexOf("export async function updateDeliveryStatus(")
  );

  assert.match(detail, /serializeDeliveryOrder\(await findDeliveryOrder\(prisma, orderId\)\)/);
  assert.match(page, /DeliveryTicketSummary\[\]/);
  assert.match(page, /"History"/);
  assert.match(page, /"All tickets"/);
  assert.match(page, /"Opening\.\.\."/);
  assert.doesNotMatch(detail, /deleteMany\(|\.delete\(/);
});
