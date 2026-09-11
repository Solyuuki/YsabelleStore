import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reportsSource = readFileSync(resolve(process.cwd(), "src/pages/ReportsPage.tsx"), "utf8");
const panelSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockPlanningPanel.tsx"),
  "utf8"
);
const apiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");

assert.match(reportsSource, /RestockPlanningPanel/);
assert.match(reportsSource, /<RestockPlanningPanel \/>/);
assert.match(reportsSource, /Restock actions are grouped separately below/);

assert.match(panelSource, /Recommended restock/);
assert.match(panelSource, /Restock planner/);
assert.match(panelSource, /Add product/);
assert.match(panelSource, /Order quantity/);
assert.match(panelSource, /Why did you change the suggested quantity/);
assert.match(panelSource, /More details and stock settings/);
assert.match(panelSource, /Not needed/);
assert.match(panelSource, /Review restock/);
assert.match(panelSource, /Save for later/);
assert.match(panelSource, /Confirm restock/);
assert.match(panelSource, /Inventory has not changed/);
assert.match(panelSource, /Physical Inventory is unchanged/);
assert.match(panelSource, /updateProduct/);
assert.match(panelSource, /DialogContent/);

assert.doesNotMatch(panelSource, /createProduct\s*\(/);
assert.doesNotMatch(panelSource, /stockInInventory\s*\(/);
assert.doesNotMatch(apiSource, /\/api\/inventory\/.*stock-in/);

assert.match(apiSource, /\/api\/restock-orders\/planning/);
assert.match(
  apiSource,
  /\/api\/restock-orders\/recommendations\/\$\{encodeURIComponent\(recommendationId\)\}\/dismiss/
);
assert.match(apiSource, /"\/api\/restock-orders"/);
assert.match(
  apiSource,
  /\/api\/restock-orders\/\$\{encodeURIComponent\(orderId\)\}\/lines/
);
assert.match(
  apiSource,
  /\/api\/restock-orders\/\$\{encodeURIComponent\(orderId\)\}\/approve/
);

console.log("Restock Phase 4-6 Reports QoL contract passed.");
