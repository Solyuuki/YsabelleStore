import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ci = readFileSync(".github/workflows/ci.yml", "utf8");

test("a new branch ref validates the source snapshot without mislabeling its active sprint", () => {
  assert.ok(
    ci.includes(
      "YSABELLE_BRANCH: ${{ github.event_name == 'push' && github.event.created && 'branch-creation' || github.head_ref || github.ref_name }}"
    ),
    "A branch-creation event must not masquerade as an already-activated sprint."
  );
  assert.match(ci, /run: npm run guardrail:preflight/);
  assert.match(ci, /run: npm run test:guardrails/);
  assert.match(ci, /run: npm run verify:code/);
});
