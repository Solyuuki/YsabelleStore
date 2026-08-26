import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveCatalogImageStoragePaths } from "../src/config/catalogImageStoragePaths.js";

test("catalog image storage uses the primary checkout as the shared root for linked worktrees", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "ysabelle-worktree-storage-"));
  const primaryRoot = path.join(temporaryRoot, "primary");
  const linkedRoot = path.join(temporaryRoot, "phase-3");
  const commonGitDirectory = path.join(primaryRoot, ".git");
  const linkedGitDirectory = path.join(commonGitDirectory, "worktrees", "phase-3");

  try {
    await mkdir(linkedGitDirectory, { recursive: true });
    await mkdir(linkedRoot, { recursive: true });
    await writeFile(path.join(linkedRoot, ".git"), `gitdir: ${linkedGitDirectory}\n`);
    await writeFile(path.join(linkedGitDirectory, "commondir"), "../..\n");
    await writeFile(path.join(linkedGitDirectory, "gitdir"), `${path.join(linkedRoot, ".git")}\n`);

    const resolved = resolveCatalogImageStoragePaths(linkedRoot, ".data/catalog-images");

    assert.equal(resolved.root, path.join(primaryRoot, ".data", "catalog-images"));
    assert.deepEqual(resolved.fallbackRoots, [
      path.join(linkedRoot, ".data", "catalog-images")
    ]);
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test("absolute catalog image storage configuration remains authoritative", () => {
  const absoluteRoot = path.resolve(os.tmpdir(), "ysabelle-catalog-images-absolute");
  const resolved = resolveCatalogImageStoragePaths("/unused/repository", absoluteRoot);

  assert.equal(resolved.root, absoluteRoot);
  assert.deepEqual(resolved.fallbackRoots, []);
});
