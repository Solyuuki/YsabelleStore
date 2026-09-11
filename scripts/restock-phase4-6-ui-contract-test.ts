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

assert.match(panelSource, /Recommended restock/);
assert.match(panelSource, /Add existing product/);
assert.match(panelSource, /Owner override reason/);
assert.match(panelSource, /Dismiss recommendation/);
assert.match(panelSource, /Create draft/);
assert.match(panelSource, /Save draft changes/);
assert.match(panelSource, /Approve selected lines/);
assert.match(panelSource, /Inventory has not changed/);
assert.match(panelSource, /Physical[\s\S]*Inventory[\s\S]*remain unchanged/);
assert.match(panelSource, /New Product creation is intentionally reserved for Phase 7/);
assert.match(panelSource, /updateProduct/);

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

console.log("Restock Phase 4-6 Reports UI contract passed.");
