import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../../frontend/src/utils/storefrontCategoryPresentation.ts", import.meta.url),
  "utf8"
);

test("About/Discover shelf attention is capped at eight categories", () => {
  assert.match(
    source,
    /export function getEssentialShelfItems\(\) \{\s*return essentialShelfItems\.slice\(0, 8\);\s*\}/
  );
});
