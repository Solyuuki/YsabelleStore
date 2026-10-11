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
    assert.match(source, /<RestockOwnerWarnings[\s\S]*?warnings=\{ownerWarnings\}/);
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

test("Owner can apply a positive system suggestion without creating another ticket", () => {
  const warnings = read("frontend/src/components/reports/RestockOwnerWarnings.tsx");
  const drafts = read("frontend/src/components/reports/RestockDraftsPanel.tsx");
  const planner = read("frontend/src/components/reports/RestockPlanningPanel.tsx");
  assert.match(warnings, /Use suggested quantity/);
  assert.match(warnings, /onApplySuggestedQuantity/);
  assert.match(warnings, /Number\.isSafeInteger\(warning\.suggestedQuantity\)/);
  assert.match(drafts, /replaceRestockOrderLines\(selectedDraft\.id/);
  assert.match(drafts, /setSelectedDraft\(updated\)/);
  assert.match(planner, /requestedQuantity: quantity/);
  assert.match(planner, /setDraftDirty\(true\)/);
});
