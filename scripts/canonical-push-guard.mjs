#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { detectChangeConflicts } from "./canonical-changeset.mjs";

const canonicalBranch = process.env.YSABELLE_CANONICAL_BRANCH ?? "sprint/v0.11/sprint-11";
const remoteRef = `origin/${canonicalBranch}`;
const STATE_PATH = "database/prisma/state/canonical-state.json";
const RECON_PATH = "database/canonical/product-images/candidate-reconciliation.json";
const DISTRIBUTION_PATH = "database/canonical/product-images/runtime-distribution.manifest.json";
const DISTRIBUTION_RECORDS_PATH =
  "database/canonical/product-images/runtime-distribution.files.tsv.gz";
const NON_VERSIONED_ASSET_CONTROL_PATHS = new Set([
  RECON_PATH,
  DISTRIBUTION_PATH,
  DISTRIBUTION_RECORDS_PATH
]);

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
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim()
  };
}

function runNode(path, args = [], env = process.env) {
  return spawnSync(process.execPath, [path, ...args], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
}

function loadJsonFromGit(ref, path) {
  const result = git(["show", `${ref}:${path}`], { allowFailure: true });
  if (result.status !== 0) return null;
  return JSON.parse(result.stdout);
}

function loadLocalJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function hasAny(changed, predicate) {
  return changed.some(predicate);
}

function requireVersionIncrease(findings, label, local, remote) {
  if (!Number.isInteger(local) || local <= remote) {
    findings.push(
      `BLOCK: ${label} changed but its canonical version did not increase (${remote} -> ${local}).`
    );
  }
}

function changedHas(changed, path) {
  return changed.includes(path);
}

function hasChangeset(changed) {
  return changed.some(
    (path) => path.startsWith("database/canonical/changesets/") && path.endsWith(".json")
  );
}

export function evaluatePushPolicy({
  changed,
  localState,
  remoteState,
  localChecksums,
  remoteChecksums
}) {
  const findings = [];

  for (const key of ["schemaVersion", "catalogVersion", "assetVersion"]) {
    if (localState[key] < remoteState[key]) {
      findings.push(`BLOCK: ${key} moved backwards (${remoteState[key]} -> ${localState[key]}).`);
    }
  }

  const schemaChanged = hasAny(
    changed,
    (path) =>
      path === "database/prisma/schema.prisma" || path.startsWith("database/prisma/migrations/")
  );
  if (schemaChanged) {
    requireVersionIncrease(
      findings,
      "schema/migration state",
      localState.schemaVersion,
      remoteState.schemaVersion
    );
  }

  const catalogSourceChanged = changedHas(changed, localState.canonicalCatalogPath);
  const catalogMetadataChanged = hasAny(
    changed,
    (path) =>
      path.startsWith("database/canonical/releases/") ||
      (path.startsWith("database/canonical/") &&
        !path.startsWith("database/canonical/product-images/") &&
        !path.startsWith("database/canonical/changesets/"))
  );
  if (catalogSourceChanged || catalogMetadataChanged) {
    requireVersionIncrease(
      findings,
      "canonical catalog state",
      localState.catalogVersion,
      remoteState.catalogVersion
    );
  }
  if (catalogSourceChanged && !hasChangeset(changed)) {
    findings.push(
      "BLOCK: canonical catalog data changed without a deterministic committed changeset."
    );
  }

  const sourceAssetChanged = hasAny(changed, (path) =>
    path.startsWith(`${localState.canonicalProductImageRoot}/`)
  );
  const frontendAssetChanged = hasAny(changed, (path) =>
    path.startsWith("frontend/public/images/products/")
  );
  const assetStateChanged = hasAny(
    changed,
    (path) =>
      path === localState.productAssetManifestPath ||
      (path.startsWith("database/canonical/product-images/") &&
        !NON_VERSIONED_ASSET_CONTROL_PATHS.has(path)) ||
      path.startsWith("frontend/public/images/products/")
  );
  if (assetStateChanged) {
    requireVersionIncrease(
      findings,
      "canonical product asset state",
      localState.assetVersion,
      remoteState.assetVersion
    );
  }

  if (sourceAssetChanged) {
    const required = [
      STATE_PATH,
      localState.productAssetManifestPath,
      RECON_PATH,
      DISTRIBUTION_PATH,
      DISTRIBUTION_RECORDS_PATH
    ];
    for (const path of required) {
      if (!changedHas(changed, path)) {
        findings.push(`BLOCK: image publication bundle is missing required update: ${path}.`);
      }
    }
    if (!changed.some((path) => path.startsWith("database/canonical/releases/"))) {
      findings.push(
        "BLOCK: image publication bundle is missing a versioned canonical release update."
      );
    }
  }
  if (frontendAssetChanged && !changedHas(changed, localState.productAssetManifestPath)) {
    findings.push("BLOCK: frontend product images changed without the product asset manifest.");
  }

  if (
    hasAny(
      changed,
      (path) =>
        path.startsWith("database/prisma/migration-history-archive/") ||
        path === "database/prisma/state/legacy-migration-blobs.json"
    )
  ) {
    findings.push("BLOCK: Generation 1 migration archive and fingerprint registry are read-only.");
  }

  for (const [name, checksum] of Object.entries(remoteChecksums.migrations ?? {})) {
    if (localChecksums.migrations?.[name] !== checksum) {
      findings.push(`BLOCK: frozen remote migration checksum changed or disappeared: ${name}.`);
    }
  }

  return findings;
}

function changesetPathsBetween(from, to) {
  const result = git(
    [
      "diff",
      "--name-only",
      "--diff-filter=A",
      `${from}..${to}`,
      "--",
      "database/canonical/changesets/*.json"
    ],
    { allowFailure: true }
  );
  return result.status === 0 && result.stdout ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
}

function loadChangesets(ref, paths) {
  return paths.map((path) => loadJsonFromGit(ref, path)).filter(Boolean);
}

function inspectPublicationConflicts(localChangesets) {
  const findings = [];
  for (const local of localChangesets) {
    const base = local.base?.commit;
    if (!base) continue;
    const ancestry = git(["merge-base", "--is-ancestor", base, remoteRef], {
      allowFailure: true
    });
    if (ancestry.status !== 0) {
      findings.push(
        `BLOCK: changeset ${local.changesetId} base is not an ancestor of ${remoteRef}; rebase/review required.`
      );
      continue;
    }
    const remotePaths = changesetPathsBetween(base, remoteRef);
    const remoteChangesets = loadChangesets(remoteRef, remotePaths);
    for (const remote of remoteChangesets) {
      if (remote.changesetId === local.changesetId) continue;
      for (const conflict of detectChangeConflicts(local.changes ?? [], remote.changes ?? [])) {
        findings.push(
          `BLOCK: same-record/same-field canonical conflict ${conflict.table}/${conflict.id}/${conflict.field}; explicit review required.`
        );
      }
    }
  }
  return findings;
}

function envDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(".env")) return null;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (!match) continue;
    return match[1].replace(/^['"]|['"]$/g, "");
  }
  return null;
}

function main() {
  const findings = [];

  const fetchResult = git(["fetch", "--quiet", "origin", canonicalBranch], {
    allowFailure: true
  });
  if (fetchResult.status !== 0) {
    findings.push(`BLOCK: unable to refresh ${remoteRef}; canonical freshness cannot be proven.`);
  }

  if (findings.length === 0) {
    const ancestor = git(["merge-base", "--is-ancestor", remoteRef, "HEAD"], {
      allowFailure: true
    });
    if (ancestor.status !== 0) {
      findings.push(
        `BLOCK: HEAD does not contain the latest ${canonicalBranch}. Run npm run state:rebase before pushing.`
      );
    }
  }

  const dirty = git([
    "status",
    "--porcelain",
    "--",
    "database/prisma",
    "database/seed",
    "database/canonical",
    "frontend/public/images/products"
  ]).stdout;
  if (dirty) {
    findings.push(
      "BLOCK: uncommitted canonical database/image state exists. Commit the canonical state before pushing."
    );
  }

  const localState = loadLocalJson(STATE_PATH);
  const localChecksums = loadLocalJson("database/prisma/state/migration-checksums.json");
  const remoteState = loadJsonFromGit(remoteRef, STATE_PATH);
  const remoteChecksums = loadJsonFromGit(
    remoteRef,
    "database/prisma/state/migration-checksums.json"
  );

  let changed = [];
  if (remoteState && remoteChecksums) {
    const changedOutput = git(["diff", "--name-only", `${remoteRef}...HEAD`]).stdout;
    changed = changedOutput ? changedOutput.split(/\r?\n/).filter(Boolean) : [];
    findings.push(
      ...evaluatePushPolicy({
        changed,
        localState,
        remoteState,
        localChecksums,
        remoteChecksums
      })
    );
  }

  const changesetSecurity = runNode("scripts/canonical-changeset-security.mjs");
  if (changesetSecurity.status !== 0) {
    findings.push(
      "BLOCK: canonical changeset security failed: " +
        (changesetSecurity.stderr || changesetSecurity.stdout || "unknown error").trim()
    );
  }

  const localChangesetPaths = changed.filter(
    (path) => path.startsWith("database/canonical/changesets/") && path.endsWith(".json")
  );
  const localChangesets = localChangesetPaths.map((path) => loadLocalJson(path));
  findings.push(...inspectPublicationConflicts(localChangesets));

  if (changedHas(changed, localState.canonicalCatalogPath)) {
    const databaseUrl = envDatabaseUrl();
    if (!databaseUrl) {
      findings.push(
        "BLOCK: DATABASE_URL is required to prove canonical DB edits are fully represented before catalog publication."
      );
    } else {
      const drift = runNode("scripts/canonical-db-drift.mjs", [], {
        ...process.env,
        DATABASE_URL: databaseUrl
      });
      if (drift.status !== 0) {
        findings.push(
          "BLOCK: hidden/uncommitted canonical DB drift detected: " +
            (drift.stderr || drift.stdout || "unknown error").trim()
        );
      }
    }
  }

  if (findings.length > 0) {
    for (const finding of findings) console.error(finding);
    console.error(`CANONICAL_PUSH_GUARD=BLOCKED (${findings.length} findings)`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `CANONICAL_PUSH_GUARD=PASS branch=${canonicalBranch} schema=${localState.schemaVersion} catalog=${localState.catalogVersion} assets=${localState.assetVersion} changesets=${localChangesets.length}`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
