import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

const draft = read("frontend/src/components/reports/RestockDraftsPanel.tsx");
const api = read("frontend/src/services/restockApi.ts");

test("saved draft rows have interior left/right whitespace and preserved responsive scroll", () => {
  assert.match(
    draft,
    /className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4 sm:px-6"/
  );
  assert.match(
    draft,
    /className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"\s+key=\{line\.id\}/
  );
  assert.match(draft, /<DialogFooter className="shrink-0 flex-wrap gap-2">/);
  assert.match(draft, /className="ys-report-modal flex max-h-\[calc\(100dvh-2rem\)\]/);
});

test("manual draft uses explicit two-stage permanent removal confirmation, not receiving cancellation", () => {
  assert.match(draft, /removePromptOpen/);
  assert.match(draft, /Remove draft/);
  assert.match(draft, /Yes, remove draft/);
  assert.match(draft, /This permanently deletes/);
  assert.match(draft, /onClick=\{\(\) => void confirmRemoveDraft\(\)\}/);
  assert.match(draft, /await removeRestockDraft\(selectedDraft\.id, selectedDraft\.version\)/);
  assert.match(draft, /variant="danger"/);
  assert.match(draft, /setSelectedDraft\(null\)/);
  assert.match(draft, /await loadDrafts\(\)/);
  assert.match(draft, /selectedDraft\.status === "DRAFT" && !isRecommendedPlan\(selectedDraft\)/);
  assert.match(draft, /\^RO-\[A-Z\]\{3\}-/);
  assert.doesNotMatch(draft, /cancelRestockOrder\(/);
});

test("removal endpoint uses DELETE with expectedVersion, never cancellation mutation", () => {
  const functionBlock = api.slice(
    api.indexOf("export async function removeRestockDraft("),
    api.indexOf("export async function replaceRestockOrderLines(")
  );
  assert.match(functionBlock, /method: "DELETE"/);
  assert.match(functionBlock, /json: \{ expectedVersion \}/);
  assert.doesNotMatch(functionBlock, /\/cancel|\.cancel/);
});

test("draft kept, removal aborted, or warning acknowledged are independent actions", () => {
  assert.match(draft, /Back to draft/);
  assert.match(draft, /Keep draft/);
  assert.match(draft, /Continue with my quantities/);
  assert.match(draft, /Confirm & send to Receiving/);
  assert.match(draft, /disabled=\{confirming \|\| removing\}/);
  assert.match(draft, /removePromptOpen && draftScrollRef\.current/);
});
