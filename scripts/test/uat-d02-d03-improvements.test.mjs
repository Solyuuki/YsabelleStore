import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const inventory = readFileSync(new URL("../../frontend/src/pages/InventoryPage.tsx", import.meta.url), "utf8");
const orders = readFileSync(new URL("../../frontend/src/pages/customer/CustomerAccountPage.tsx", import.meta.url), "utf8");
test("D02 inventory fetch has no forced 400–500ms minimum loading time", () => {
 assert.match(inventory,/await fetchInventory\(query, \{ signal: controller\.signal \}\)/);
 assert.doesNotMatch(inventory,/INVENTORY_UPDATE_MINIMUM_MS|INVENTORY_INITIAL_MINIMUM_MS/);
 assert.match(inventory,/transition-opacity duration-150/);
});
test("D03 customer order timeline uses consistent ready-for-delivery wording", () => {
 assert.match(orders,/status: "READY_FOR_DELIVERY", label: "Ready for delivery"/);
 assert.match(orders,/aria-current=\{isCurrent \? "step" : undefined\}/);
});
