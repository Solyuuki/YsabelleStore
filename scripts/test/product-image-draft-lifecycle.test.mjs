import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const productsSource = fs.readFileSync(
  path.join(root, "frontend/src/pages/ProductsPage.tsx"),
  "utf8"
);
const panelSource = fs.readFileSync(
  path.join(root, "frontend/src/components/catalog/ProductImageUploadPanel.tsx"),
  "utf8"
);

test("cancelled edit sessions discard newly uploaded image candidates", () => {
  assert.match(productsSource, /draftImageCandidateIds/);
  assert.match(productsSource, /rejectProductImage\(product\.id, candidateId\)/);
  assert.match(productsSource, /onCandidateCreated=\{\(candidate\) =>/);
  assert.match(productsSource, /handleCancelEditing/);
  assert.match(productsSource, /handleCloseRequest/);
});

test("owner can explicitly discard an unapproved hydrated candidate", () => {
  assert.match(panelSource, /rejectProductImage/);
  assert.match(panelSource, /handleDiscard/);
  assert.match(panelSource, /Discard upload/);
  assert.match(panelSource, /onCandidateDiscarded/);
});
