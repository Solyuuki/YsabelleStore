#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildCanonicalSnapshot, createChangeset } from "./canonical-changeset.mjs";
import { canonicalTextBytes, sha256CanonicalText } from "./lib/canonical-text.mjs";

const STATE_PATH = "database/prisma/state/canonical-state.json";
const CHECKSUM_PATH = "database/prisma/state/migration-checksums.json";
const ASSET_MANIFEST_PATH = "database/prisma/state/product-assets.manifest.json";
const RECON_PATH = "database/canonical/product-images/candidate-reconciliation.json";
const DISTRIBUTION_PATH = "database/canonical/product-images/runtime-distribution.manifest.json";
const CHANGESET_ROOT = "database/canonical/changesets";
const ACTIVE_MIGRATIONS = "database/prisma/migrations";
const ASSET_ROOT = "frontend/public/images/products";
const BINARY_ASSET = /\.(?:avif|jpe?g|png|webp)$/i;

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  if (!allowFailure && result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }
  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim()
  };
}

function sha256File(path) {
  return sha256CanonicalText(readFileSync(path));
}

function gitBlobOid(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
}

function writeJson(path, value) {
  writeFileSync(path, jsonBytes(value));
}

function readGitText(ref, path) {
  const result = git(["show", `${ref}:${path}`], { allowFailure: true });
  return result.status === 0 ? result.stdout + "\n" : null;
}

function readGitJson(ref, path) {
  const text = readGitText(ref, path);
  return text === null ? null : JSON.parse(text);
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
  for (const entry of readdirSync(ACTIVE_MIGRATIONS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(ACTIVE_MIGRATIONS, entry.name, "migration.sql");
    if (existsSync(path)) result.push({ name: entry.name, path });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function readIndexedAssets() {
  const raw = git(["ls-files", "-s", "--", ASSET_ROOT]).stdout;
  const assets = [];
  for (const line of lines(raw)) {
    const match = line.match(/^\d+\s+([0-9a-f]{40})\s+0\t(.+)$/);
    if (!match) continue;
    const [, oid, path] = match;
    if (!BINARY_ASSET.test(path)) continue;
    assets.push({ path, gitBlobOid: oid });
  }
  return assets.sort((a, b) => a.path.localeCompare(b.path));
}

function sameAssets(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function desiredReleaseId(state) {
  return `g${state.migrationEpoch}-s${state.schemaVersion}-c${state.catalogVersion}-a${state.assetVersion}`;
}

function refreshReleaseSourceImages(release) {
  for (const product of release.products ?? []) {
    const path = product.sourceImage?.path;
    if (!path || !existsSync(path)) continue;
    const bytes = readFileSync(path);
    product.sourceImage.sizeBytes = bytes.length;
    product.sourceImage.gitBlobOid = gitBlobOid(bytes);
  }
}

function rolloverRelease({ state, release, reconciliation, distribution }) {
  const releaseId = desiredReleaseId(state);
  const releasePath = `database/canonical/releases/${releaseId}.json`;

  release.releaseId = releaseId;
  release.migrationEpoch = state.migrationEpoch;
  release.catalogVersion = state.catalogVersion;
  release.assetVersion = state.assetVersion;
  refreshReleaseSourceImages(release);

  reconciliation.releaseId = releaseId;
  distribution.releaseId = releaseId;
  distribution.assetVersion = state.assetVersion;

  state.releaseId = releaseId;
  state.canonicalReleasePath = releasePath;

  const releaseBytes = jsonBytes(release);
  state.canonicalReleaseGitBlobOid = gitBlobOid(releaseBytes);

  writeFileSync(releasePath, releaseBytes);
  writeJson(RECON_PATH, reconciliation);
  writeJson(DISTRIBUTION_PATH, distribution);
  git(["add", "--", releasePath, RECON_PATH, DISTRIBUTION_PATH]);
}

function buildSnapshotFromWorking(state, release, reconciliation) {
  return buildCanonicalSnapshot({
    catalogSql: readFileSync(state.canonicalCatalogPath, "utf8"),
    release,
    reconciliation
  });
}

function buildSnapshotFromGit(ref, state) {
  const catalogSql = readGitText(ref, state.canonicalCatalogPath);
  const release = readGitJson(ref, state.canonicalReleasePath);
  const reconciliation = readGitJson(ref, RECON_PATH);
  if (catalogSql === null || !release || !reconciliation) {
    throw new Error(`Cannot reconstruct canonical changeset base from ${ref}.`);
  }
  return buildCanonicalSnapshot({ catalogSql, release, reconciliation });
}

function writeChangeset({ baseCommit, baseState, targetState, baseSnapshot, targetSnapshot }) {
  const changeset = createChangeset({
    baseCommit,
    baseState,
    targetState,
    baseSnapshot,
    targetSnapshot
  });
  if (!changeset.changes.length) return null;
  const path = join(CHANGESET_ROOT, `${changeset.changesetId}.json`);
  writeJson(path, changeset);
  git(["add", "--", path]);
  return path;
}

function main() {
  const staged = lines(git(["diff", "--cached", "--name-only"]).stdout);
  const relevant = staged.filter(canonicalPath);
  if (relevant.length === 0) {
    console.log("CANONICAL_STATE_PREPARE=NOOP");
    return;
  }

  const unstaged = lines(git(["diff", "--name-only"]).stdout).filter(canonicalPath);
  if (unstaged.length > 0) {
    console.error(
      "BLOCK: canonical DB/image files have unstaged edits. Fully stage or revert them before committing:"
    );
    for (const path of unstaged) console.error(`  - ${path}`);
    process.exit(1);
  }

  const baseCommit = git(["rev-parse", "HEAD"]).stdout;
  const baseState = readGitJson("HEAD", STATE_PATH);
  if (!baseState) throw new Error("Cannot read canonical state from HEAD.");
  const baseSnapshot = buildSnapshotFromGit("HEAD", baseState);

  const state = readJson(STATE_PATH);
  const checksums = readJson(CHECKSUM_PATH);
  const assetManifest = readJson(ASSET_MANIFEST_PATH);
  let release = readJson(state.canonicalReleasePath);
  const reconciliation = readJson(RECON_PATH);
  const distribution = readJson(DISTRIBUTION_PATH);

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

  if (
    staged.some((path) => path.startsWith("database/canonical/releases/") || path === RECON_PATH)
  ) {
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
  if (
    staged.some(
      (path) =>
        path.startsWith(`${state.canonicalProductImageRoot}/`) || path.startsWith(`${ASSET_ROOT}/`)
    )
  ) {
    assetsChanged = true;
  }

  if (schemaChanged) state.schemaVersion += 1;
  if (catalogChanged) state.catalogVersion += 1;
  if (assetsChanged) {
    state.assetVersion += 1;
    assetManifest.assetVersion = state.assetVersion;
  }

  if (schemaChanged || catalogChanged || assetsChanged) {
    rolloverRelease({ state, release, reconciliation, distribution });
    release = readJson(state.canonicalReleasePath);
  } else {
    const releaseBytes = canonicalTextBytes(readFileSync(state.canonicalReleasePath));
    state.canonicalReleaseGitBlobOid = gitBlobOid(releaseBytes);
  }

  writeJson(STATE_PATH, state);
  writeJson(CHECKSUM_PATH, checksums);
  writeJson(ASSET_MANIFEST_PATH, assetManifest);
  git(["add", "--", STATE_PATH, CHECKSUM_PATH, ASSET_MANIFEST_PATH]);

  let changesetPath = null;
  if (catalogChanged) {
    const targetSnapshot = buildSnapshotFromWorking(state, release, readJson(RECON_PATH));
    changesetPath = writeChangeset({
      baseCommit,
      baseState,
      targetState: state,
      baseSnapshot,
      targetSnapshot
    });
  }

  console.log(
    `CANONICAL_STATE_PREPARE=PASS schemaChanged=${schemaChanged} catalogChanged=${catalogChanged} assetsChanged=${assetsChanged} changeset=${changesetPath ?? "none"}`
  );
}

main();
