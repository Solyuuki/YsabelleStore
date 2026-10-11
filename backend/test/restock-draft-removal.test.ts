import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { removeRestockDraftSchema } from "../src/validators/restock.validators.js";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("draft removal requires a valid optimistic version", () => {
  assert.deepEqual(removeRestockDraftSchema.parse({ expectedVersion: 3 }), { expectedVersion: 3 });
  for (const input of [{}, { expectedVersion: -1 }, { expectedVersion: 1.5 }, { expectedVersion: "invalid" }]) {
    assert.equal(removeRestockDraftSchema.safeParse(input).success, false);
  }
});

test("manual draft removal is an Owner-only DELETE endpoint, not ticket cancellation", () => {
  const route = read("backend/src/routes/restock.routes.ts");
  const controller = read("backend/src/controllers/restockController.ts");
  const start = route.indexOf('router.use(requireAuth, requireRole("OWNER"));');
  const endpoint = route.indexOf('router.delete("/:orderId", removeRestockDraftController)');
  assert.ok(start >= 0 && endpoint > start);
  assert.match(controller, /removeRestockDraftSchema/);
  assert.match(controller, /requireActorId\(request\)/);
  assert.match(controller, /await removeManualRestockDraft\(params\.orderId, body\.expectedVersion\)/);
  assert.doesNotMatch(controller.slice(controller.indexOf("removeRestockDraftController"), controller.indexOf("updateRestockOrderController")), /cancelRestockOrder\(/);
});

test("manual draft removal deletes only the version-matching unapproved order", () => {
  const source = read("backend/src/services/restockService.ts");
  const start = source.indexOf("export async function removeManualRestockDraft(");
  const end = source.indexOf("export async function replaceRestockOrderLines(", start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  assert.match(body, /await prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(body, /assertDraft\(existing, expectedVersion\)/);
  assert.match(body, /isAutomatedMonthlyOrder\(existing\.notes\)/);
  assert.match(body, /existing\.orderNumber/);
  assert.match(body, /existing\.lines\.some\(\(line\) => line\.receivedQuantity > 0\)/);
  assert.match(body, /await tx\.restockOrder\.deleteMany\(/);
  assert.match(body, /status: RestockOrderStatus\.DRAFT/);
  assert.match(body, /version: expectedVersion/);
  assert.match(body, /removed\.count !== 1/);
  assert.doesNotMatch(body, /RestockOrderStatus\.CANCELLED|stockIn|receiveStockInTransaction/);
});

test("draft lines cascade on permanent deletion without deleting products or recommendations", () => {
  const schema = read("database/prisma/schema.prisma");
  const restockLine = schema.slice(schema.indexOf("model RestockOrderLine {"), schema.indexOf("\nmodel CustomerModerationAudit {"));
  assert.match(restockLine, /order\s+RestockOrder\s+@relation\(fields: \[restockOrderId\], references: \[id\], onDelete: Cascade/);
  assert.match(restockLine, /product\s+Product\s+@relation\(fields: \[productId\], references: \[id\], onDelete: Restrict/);
  assert.match(restockLine, /recommendation\s+RecommendationRecord\?\s+@relation\(fields: \[recommendationId\], references: \[id\], onDelete: SetNull/);
});
