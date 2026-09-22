#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const STATE_PATH = "database/prisma/state/canonical-state.json";
const CHECKSUM_PATH = "database/prisma/state/migration-checksums.json";
const ASSET_MANIFEST_PATH = "database/prisma/state/product-assets.manifest.json";
const ACTIVE_MIGRATIONS = "database/prisma/migrations";
const ASSET_ROOT = "frontend/public/images/products";
const BINARY_ASSET = /\.(?:avif|jpe?g|png|webp)$/i;

function git(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }
  return (result.stdout ?? "").trim();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

function canonicalPath(path) {
  return (
    path.startsWith("database/prisma/") ||
    path.startsWith("database/seed/") ||
    path.startsWith("database/canonical/") ||
    path.startsWith(`${ASSET_ROOT}/`)
  );
}

function listActiveMigrations() {
  const result = [];
  for (const entry of readdirSync(ACTIVE_MIGRATIONS, {
    withFileTypes: true
  })) {
    if (!entry.isDirectory()) continue;
    const path = join(ACTIVE_MIGRATIONS, entry.name, "migration.sql");
    if (existsSync(path)) result.push({ name: entry.name, path });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function readIndexedAssets() {
  const raw = git(["ls-files", "-s", "--", ASSET_ROOT]);
  const assets = [];
  for (const line of lines(raw)) {
    const match = line.match(/^\d+\s+([0-9a-f]{40})\s+0\t(.+)$/);
    if (!match) continue;
    const [, gitBlobOid, path] = match;
    if (!BINARY_ASSET.test(path)) continue;
    assets.push({ path, gitBlobOid });
  }
  return assets.sort((a, b) => a.path.localeCompare(b.path));
}

function sameAssets(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function main() {
  const staged = lines(git(["diff", "--cached", "--name-only"]));
  const relevant = staged.filter(canonicalPath);
  if (relevant.length === 0) {
    console.log("CANONICAL_STATE_PREPARE=NOOP");
    return;
  }

  const unstaged = lines(git(["diff", "--name-only"])).filter(canonicalPath);
  if (unstaged.length > 0) {
    console.error(
      "BLOCK: canonical DB/image files have unstaged edits. Fully stage or revert them before committing:"
    );
    for (const path of unstaged) console.error(`  - ${path}`);
    process.exit(1);
  }

  const state = readJson(STATE_PATH);
  const checksums = readJson(CHECKSUM_PATH);
  const assetManifest = readJson(ASSET_MANIFEST_PATH);

  let schemaChanged = false;
  let catalogChanged = false;
  let assetsChanged = false;

  const schemaDigest = sha256File(state.schemaPath);
  if (schemaDigest !== state.schemaSha256) {
    state.schemaSha256 = schemaDigest;
    schemaChanged = true;
  }

  const catalogDigest = sha256File(state.canonicalCatalogPath);
  if (catalogDigest !== state.canonicalCatalogSha256) {
    state.canonicalCatalogSha256 = catalogDigest;
    catalogChanged = true;
  }

  checksums.migrations ??= {};
  for (const migration of listActiveMigrations()) {
    const digest = sha256File(migration.path);
    const frozen = checksums.migrations[migration.name];
    if (frozen && frozen !== digest) {
      console.error(
        `BLOCK: frozen migration ${migration.name} was edited. Create a new migration instead.`
      );
      process.exit(1);
    }
    if (!frozen) {
      checksums.migrations[migration.name] = digest;
      schemaChanged = true;
    }
  }
  checksums.migrations = Object.fromEntries(
    Object.entries(checksums.migrations).sort(([a], [b]) => a.localeCompare(b))
  );

  const indexedAssets = readIndexedAssets();
  if (!sameAssets(indexedAssets, assetManifest.trackedAssets ?? [])) {
    assetManifest.trackedAssets = indexedAssets;
    assetsChanged = true;
  }

  if (schemaChanged) state.schemaVersion += 1;
  if (catalogChanged) state.catalogVersion += 1;
  if (assetsChanged) {
    state.assetVersion += 1;
    assetManifest.assetVersion = state.assetVersion;
  }

  writeJson(STATE_PATH, state);
  writeJson(CHECKSUM_PATH, checksums);
  writeJson(ASSET_MANIFEST_PATH, assetManifest);

  git(["add", "--", STATE_PATH, CHECKSUM_PATH, ASSET_MANIFEST_PATH]);

  console.log(
    `CANONICAL_STATE_PREPARE=PASS schemaChanged=${schemaChanged} catalogChanged=${catalogChanged} assetsChanged=${assetsChanged}`
  );
}

main();
