import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const API_SOURCE = path.join(REPO_ROOT, "frontend", "src", "services", "productImageApi.ts");
const PANEL_SOURCE = path.join(
  REPO_ROOT,
  "frontend",
  "src",
  "components",
  "catalog",
  "ProductImageUploadPanel.tsx"
);

test("existing product image review hydrates the latest CIQE candidate without auto-approval", () => {
  const apiSource = fs.readFileSync(API_SOURCE, "utf8");
  const panelSource = fs.readFileSync(PANEL_SOURCE, "utf8");

  assert.match(apiSource, /export async function fetchLatestProductImageCandidate/);
  assert.match(apiSource, /\/images\/latest/);
  assert.match(panelSource, /fetchLatestProductImageCandidate/);
  assert.match(
    panelSource,
    /fetchProductImagePreviewBlob\(\s*productId,\s*hydratedCandidate\.id,\s*"original"/
  );
  assert.match(panelSource, /selectedFile \|\| candidate/);
  assert.match(panelSource, /Use Optimized Image/);
  assert.doesNotMatch(
    panelSource,
    /fetchLatestProductImageCandidate[\s\S]{0,800}approveProductImage\(/
  );
});
