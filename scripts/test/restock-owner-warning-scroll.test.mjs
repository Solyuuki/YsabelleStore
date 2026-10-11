import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

const planner = read("frontend/src/components/reports/RestockPlanningPanel.tsx");
const drafts = read("frontend/src/components/reports/RestockDraftsPanel.tsx");

function dialogSnippet(source, identifier) {
  const start = source.indexOf(identifier);
  assert.ok(start >= 0, "Restock dialog not found");
  const end = source.indexOf("</DialogContent>", start);
  assert.ok(end > start, "Missing dialog closing tag");
  return source.slice(start, end);
}

function checkScrollableReview(source, id, refName) {
  const dialog = dialogSnippet(source, id);
  assert.match(
    dialog,
    /<DialogContent className="ys-report-modal flex max-h-\[calc\(100dvh-2rem\)\].*? flex-col gap-0 overflow-hidden sm:max-h-\[88dvh\]"/
  );
  assert.match(dialog, /<DialogHeader className="shrink-0 pb-4">/);
  assert.match(
    dialog,
    /className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain (?:px-6 pb-4|px-5 pb-4 sm:px-6)"/
  );
  assert.ok(dialog.includes(`ref={${refName}}`));
  assert.match(dialog, /role="region"/);
  assert.match(dialog, /tabIndex=\{0\}/);
  assert.match(dialog, /<DialogFooter className="shrink-0(?: flex-wrap gap-2)?">/);

  const warningIndex = dialog.indexOf("<RestockOwnerWarnings");
  const scrollerIndex = dialog.indexOf(`ref={${refName}}`);
  const scrollerEndIndex = dialog.indexOf("</div>\n\n", warningIndex);
  const footerIndex = dialog.indexOf('<DialogFooter className="shrink-0');
  assert.ok(scrollerIndex >= 0 && warningIndex > scrollerIndex);
  assert.ok(scrollerEndIndex > warningIndex && footerIndex > scrollerEndIndex);
  assert.equal(
    dialog.includes("max-h-[36vh]"),
    false,
    "Nested product scroller can trap wheel scrolling"
  );
  assert.match(
    source,
    new RegExp(refName + "\\.current\\.scrollTop = " + refName + "\\.current\\.scrollHeight")
  );
}

test("manual Restock review scrolls complete product + warning content while keeping actions visible", () => {
  checkScrollableReview(planner, "<Dialog onOpenChange={setReviewOpen}", "reviewScrollRef");
  const dialog = dialogSnippet(planner, "<Dialog onOpenChange={setReviewOpen}");
  assert.match(dialog, /Continue with my quantities/);
  assert.match(dialog, /Use suggested quantity|onApplySuggestedQuantity/);
  assert.match(dialog, /Review restock/);
});

test("saved restock drafts use the same bounded scrolling review after purchasing warnings", () => {
  checkScrollableReview(drafts, '<DialogContent className="ys-report-modal flex', "draftScrollRef");
  const dialog = dialogSnippet(drafts, '<DialogContent className="ys-report-modal flex');
  assert.match(dialog, /Continue with my quantities/);
  assert.match(dialog, /Keep draft/);
});

test("quantity and procurement approval rules are untouched by scroll changes", () => {
  assert.match(planner, /confirmRestock\(ownerWarnings\.length > 0\)/);
  assert.match(drafts, /confirmDraft\(ownerWarnings\.length > 0\)/);
  assert.match(planner, /setDraftDirty\(true\)/);
  assert.match(drafts, /replaceRestockOrderLines\(selectedDraft\.id/);
});
