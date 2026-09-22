#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const canonicalBranch =
  process.env.YSABELLE_CANONICAL_BRANCH ?? "sprint/v0.11/sprint-11";
const remoteRef = `origin/${canonicalBranch}`;

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

function loadJsonFromGit(ref, path) {
  const result = git(["show", `${ref}:${path}`], { allowFailure: true });
  if (result.status !== 0) return null;
  return JSON.parse(result.stdout);
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
      findings.push(
        `BLOCK: ${key} moved backwards (${remoteState[key]} -> ${localState[key]}).`
      );
    }
  }

  if (
    hasAny(
      changed,
      (path) =>
        path === "database/prisma/schema.prisma" ||
        path.startsWith("database/prisma/migrations/")
    )
  ) {
    requireVersionIncrease(
      findings,
      "schema/migration state",
      localState.schemaVersion,
      remoteState.schemaVersion
    );
  }

  if (
    hasAny(
      changed,
      (path) =>
        path === localState.canonicalCatalogPath ||
        path.startsWith("database/canonical/")
    )
  ) {
    requireVersionIncrease(
      findings,
      "canonical catalog state",
      localState.catalogVersion,
      remoteState.catalogVersion
    );
  }

  if (
    hasAny(
      changed,
      (path) =>
        path === localState.productAssetManifestPath ||
        path.startsWith("frontend/public/images/products/")
    )
  ) {
    requireVersionIncrease(
      findings,
      "canonical product asset state",
      localState.assetVersion,
      remoteState.assetVersion
    );
  }

  if (
    hasAny(changed, (path) =>
      path.startsWith("database/prisma/migration-history-archive/")
    )
  ) {
    findings.push("BLOCK: Generation 1 migration archive is read-only.");
  }

  for (const [name, checksum] of Object.entries(remoteChecksums.migrations ?? {})) {
    if (localChecksums.migrations?.[name] !== checksum) {
      findings.push(`BLOCK: frozen remote migration checksum changed or disappeared: ${name}.`);
    }
  }

  return findings;
}

function main() {
  const findings = [];

  const fetchResult = git(["fetch", "--quiet", "origin", canonicalBranch], {
    allowFailure: true
  });
  if (fetchResult.status !== 0) {
    findings.push(
      `BLOCK: unable to refresh ${remoteRef}; canonical freshness cannot be proven.`
    );
  }

  if (findings.length === 0) {
    const ancestor = git(["merge-base", "--is-ancestor", remoteRef, "HEAD"], {
      allowFailure: true
    });
    if (ancestor.status !== 0) {
      findings.push(
        `BLOCK: HEAD does not contain the latest ${canonicalBranch}. Pull/rebase the canonical branch before pushing.`
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

  const localState = JSON.parse(
    readFileSync("database/prisma/state/canonical-state.json", "utf8")
  );
  const localChecksums = JSON.parse(
    readFileSync("database/prisma/state/migration-checksums.json", "utf8")
  );
  const remoteState = loadJsonFromGit(
    remoteRef,
    "database/prisma/state/canonical-state.json"
  );
  const remoteChecksums = loadJsonFromGit(
    remoteRef,
    "database/prisma/state/migration-checksums.json"
  );

  if (remoteState && remoteChecksums) {
    const changedOutput = git([
      "diff",
      "--name-only",
      `${remoteRef}...HEAD`
    ]).stdout;
    const changed = changedOutput ? changedOutput.split(/\r?\n/) : [];
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

  if (findings.length > 0) {
    for (const finding of findings) console.error(finding);
    console.error(`CANONICAL_PUSH_GUARD=BLOCKED (${findings.length} findings)`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `CANONICAL_PUSH_GUARD=PASS branch=${canonicalBranch} schema=${localState.schemaVersion} catalog=${localState.catalogVersion} assets=${localState.assetVersion}`
  );
}

if (!process.env.CI || process.argv.includes("--run-in-ci")) {
  main();
}
