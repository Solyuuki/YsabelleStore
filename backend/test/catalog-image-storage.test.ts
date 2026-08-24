import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CatalogImageStorage } from "../src/modules/catalog-image/catalogImageStorage.js";

test("catalog image storage exposes only generated candidate output paths", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "ysabelle-catalog-images-"));

  try {
    const storage = new CatalogImageStorage(temporaryRoot);
    const directory = await storage.prepareCandidateOutputDirectory("candidate-2");

    assert.equal(directory, path.join(temporaryRoot, "candidates", "candidate-2", "processed"));
    assert.equal(
      storage.variantStorageKey("candidate-2", "processed"),
      "candidates/candidate-2/processed/processed.webp"
    );
    assert.equal(
      storage.variantStorageKey("candidate-2", "card"),
      "candidates/candidate-2/processed/card.webp"
    );
    assert.equal(
      storage.variantStorageKey("candidate-2", "pdp"),
      "candidates/candidate-2/processed/pdp.webp"
    );
    assert.throws(() => storage.variantStorageKey("candidate-2", "../../escape" as never));
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});
