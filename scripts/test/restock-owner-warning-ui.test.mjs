import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("both Owner approval entry points show warnings and explicit continue action", () => {
  const drafts = read("frontend/src/components/reports/RestockDraftsPanel.tsx");
  const planner = read("frontend/src/components/reports/RestockPlanningPanel.tsx");
  for (const [name, source] of [["Draft approval", drafts], ["Planner approval", planner]]) {
    assert.match(source, /RestockOwnerWarningError/);
    assert.match(source, /setOwnerWarnings\(requestError\.warnings\)/);
    assert.match(source, /ownerWarnings\.length > 0/);
    assert.match(source, /Continue with my quantities/);
    assert.match(source, /<RestockOwnerWarnings warnings=\{ownerWarnings\}/);
  }
});

test("Owner warning payload preserves original selected units, does not create duplicate ticket", () => {
  const api = read("frontend/src/services/restockApi.ts");
  const warnings = read("frontend/src/components/reports/RestockOwnerWarnings.tsx");
  assert.match(api, /RESTOCK_OWNER_WARNING_ACK_REQUIRED/);
  assert.match(api, /json: \{ expectedVersion, acknowledgeWarnings \}/);
  assert.match(warnings, /Your acknowledgment will be recorded/);
  assert.match(warnings, /Requested: /);
  assert.match(warnings, /System suggests: /);
  assert.doesNotMatch(warnings, /createRestockOrder/);
});
