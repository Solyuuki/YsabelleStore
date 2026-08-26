import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("catalog image storage recovers an existing asset from a linked-worktree fallback root", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "ysabelle-catalog-fallback-"));
  const canonicalRoot = path.join(temporaryRoot, "primary", ".data", "catalog-images");
  const legacyRoot = path.join(temporaryRoot, "phase-worktree", ".data", "catalog-images");
  const key = "candidates/candidate-legacy/original.webp";

  try {
    const legacyFile = path.join(legacyRoot, ...key.split("/"));
    await mkdir(path.dirname(legacyFile), { recursive: true });
    await writeFile(legacyFile, Buffer.from("legacy-image"));

    const storage = new CatalogImageStorage(canonicalRoot, [legacyRoot]);
    const recovered = await storage.readStorageKey(key);

    assert.equal(recovered.toString(), "legacy-image");
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});
