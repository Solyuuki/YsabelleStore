import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getDomainChangeEffects } from "../src/services/domainChangeService.js";
import {
  createRestockOrderSchema,
  restockOrderListQuerySchema,
  restockOrderStatusSchema
} from "../src/validators/restock.validators.js";

const restockRouteSource = readFileSync(
  new URL("../src/routes/restock.routes.ts", import.meta.url),
  "utf8"
);
const restockServiceSource = readFileSync(
  new URL("../src/services/restockService.ts", import.meta.url),
  "utf8"
);
const posServiceSource = readFileSync(
  new URL("../src/services/posService.ts", import.meta.url),
  "utf8"
);

test("Phase 4 restock lifecycle exposes the six planned statuses", () => {
  assert.deepEqual(restockOrderStatusSchema.options, [
    "DRAFT",
    "APPROVED",
    "AWAITING_DELIVERY",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "CANCELLED"
  ]);
});

test("Restock order history supports paged reference search and multi-status filters", () => {
  const query = restockOrderListQuerySchema.parse({
    page: "2",
    pageSize: "10",
    search: " RO-2026 ",
    statuses: "APPROVED,AWAITING_DELIVERY,PARTIALLY_RECEIVED"
  });

  assert.equal(query.page, 2);
  assert.equal(query.pageSize, 10);
  assert.equal(query.search, "RO-2026");
  assert.deepEqual(query.statuses, ["APPROVED", "AWAITING_DELIVERY", "PARTIALLY_RECEIVED"]);
  assert.match(restockServiceSource, /orderNumber: \{ contains: query\.search \}/);
  assert.match(restockServiceSource, /status: statuses\.length === 1 \? statuses\[0\] : \{ in: statuses \}/);
});

test("Phase 6 selected lines require positive requested quantity", () => {
  const result = createRestockOrderSchema.safeParse({
    lines: [
      {
        productId: "product-1",
        recommendationSource: "MANUAL",
        recommendedQuantity: 0,
        requestedQuantity: 0,
        isSelected: true
      }
    ]
  });

  assert.equal(result.success, false);
});

test("Phase 6 automated quantity overrides require an Owner reason", () => {
  const withoutReason = createRestockOrderSchema.safeParse({
    lines: [
      {
        productId: "product-1",
        recommendationId: "recommendation-1",
        recommendationSource: "SARIMA",
        recommendedQuantity: 24,
        requestedQuantity: 36,
        isSelected: true
      }
    ]
  });
  const withReason = createRestockOrderSchema.safeParse({
    lines: [
      {
        productId: "product-1",
        recommendationId: "recommendation-1",
        recommendationSource: "SARIMA",
        recommendedQuantity: 24,
        requestedQuantity: 36,
        isSelected: true,
        ownerOverrideReason: "Owner expects a weekend demand spike."
      }
    ]
  });

  assert.equal(withoutReason.success, false);
  assert.equal(withReason.success, true);
});

test("Phase 5 only sales dirty affected SARIMA results", () => {
  assert.equal(getDomainChangeEffects("STOCK_SOLD").forecast, "AFFECTED_PRODUCTS");
  assert.equal(getDomainChangeEffects("STOCK_RECEIVED").forecast, "NONE");
  assert.equal(getDomainChangeEffects("STOCK_ADJUSTED").forecast, "NONE");
  assert.equal(getDomainChangeEffects("TARGET_CHANGED").forecast, "NONE");
  assert.equal(getDomainChangeEffects("REORDER_LEVEL_CHANGED").forecast, "NONE");
  assert.match(
    posServiceSource,
    /invalidateForecastCache\(normalizedItems\.map\(\(item\) => item\.productId\)\)/
  );
});

test("Phase 4-6 restock API is Owner-only and exposes planning through approval", () => {
  assert.match(restockRouteSource, /router\.use\(requireAuth, requireRole\("OWNER"\)\)/);
  assert.match(restockRouteSource, /router\.get\("\/planning", listRestockPlanningController\)/);
  assert.match(restockRouteSource, /\/recommendations\/:recommendationId\/dismiss/);
  assert.match(restockRouteSource, /router\.post\("\/", createRestockOrderController\)/);
  assert.match(
    restockRouteSource,
    /router\.put\("\/:orderId\/lines", replaceRestockOrderLinesController\)/
  );
  assert.match(
    restockRouteSource,
    /router\.post\("\/:orderId\/approve", approveRestockOrderController\)/
  );
});

test("Phase 4-6 approval creates incoming intent without physical stock mutation", () => {
  assert.match(restockServiceSource, /status: RestockOrderStatus\.APPROVED/);
  assert.match(
    restockServiceSource,
    /RestockOrderStatus\.APPROVED,[\s\S]*RestockOrderStatus\.AWAITING_DELIVERY,[\s\S]*RestockOrderStatus\.PARTIALLY_RECEIVED/
  );
  assert.doesNotMatch(restockServiceSource, /stockInBatch\s*\(/);
  assert.doesNotMatch(restockServiceSource, /inventoryBatch\.(create|update|upsert)\s*\(/);
  assert.doesNotMatch(restockServiceSource, /inventoryMovement\.(create|update|upsert)\s*\(/);
});
