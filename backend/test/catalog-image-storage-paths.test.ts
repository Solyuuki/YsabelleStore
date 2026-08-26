import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveCatalogImageStoragePaths,
  resolveDefaultCatalogImagePersistentRoot
} from "../src/config/catalogImageStoragePaths.js";

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
    assert.deepEqual(resolved.fallbackRoots, [path.join(linkedRoot, ".data", "catalog-images")]);
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test("development catalog storage resolves outside disposable repository checkouts", () => {
  const homeDirectory = path.resolve("C:/Users/example");
  const windowsRoot = resolveDefaultCatalogImagePersistentRoot({
    environment: { LOCALAPPDATA: "C:/Users/example/AppData/Local" },
    homeDirectory,
    platform: "win32"
  });
  const linuxRoot = resolveDefaultCatalogImagePersistentRoot({
    environment: { XDG_DATA_HOME: "/home/example/.data" },
    homeDirectory: "/home/example",
    platform: "linux"
  });

  assert.equal(
    windowsRoot,
    path.resolve("C:/Users/example/AppData/Local", "YsabelleStore", "catalog-images")
  );
  assert.equal(linuxRoot, path.resolve("/home/example/.data", "YsabelleStore", "catalog-images"));
});

test("legacy repo-local catalog storage migrates to a durable user-level root", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "ysabelle-persistent-storage-"));
  const primaryRoot = path.join(temporaryRoot, "primary");
  const linkedRoot = path.join(temporaryRoot, "phase-3");
  const persistentRoot = path.join(temporaryRoot, "user-data", "catalog-images");
  const commonGitDirectory = path.join(primaryRoot, ".git");
  const linkedGitDirectory = path.join(commonGitDirectory, "worktrees", "phase-3");

  try {
    await mkdir(linkedGitDirectory, { recursive: true });
    await mkdir(linkedRoot, { recursive: true });
    await writeFile(path.join(linkedRoot, ".git"), `gitdir: ${linkedGitDirectory}\n`);
    await writeFile(path.join(linkedGitDirectory, "commondir"), "../..\n");
    await writeFile(path.join(linkedGitDirectory, "gitdir"), `${path.join(linkedRoot, ".git")}\n`);

    const resolved = resolveCatalogImageStoragePaths(
      linkedRoot,
      ".data/catalog-images",
      persistentRoot
    );

    assert.equal(resolved.root, persistentRoot);
    assert.deepEqual(resolved.fallbackRoots, [
      path.join(primaryRoot, ".data", "catalog-images"),
      path.join(linkedRoot, ".data", "catalog-images")
    ]);
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test("absolute catalog image storage configuration remains authoritative", () => {
  const absoluteRoot = path.resolve(os.tmpdir(), "ysabelle-catalog-images-absolute");
  const persistentRoot = path.resolve(os.tmpdir(), "ysabelle-catalog-images-persistent");
  const resolved = resolveCatalogImageStoragePaths(
    "/unused/repository",
    absoluteRoot,
    persistentRoot
  );

  assert.equal(resolved.root, absoluteRoot);
  assert.deepEqual(resolved.fallbackRoots, []);
});
