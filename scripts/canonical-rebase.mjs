#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { detectChangeConflicts } from "./canonical-changeset.mjs";

const canonicalBranch = process.env.YSABELLE_CANONICAL_BRANCH ?? "sprint/v0.11/sprint-11";
const remoteRef = `origin/${canonicalBranch}`;

function git(args, { allowFailure = false, inherit = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`
    );
  }
  return { status: result.status ?? 1, stdout: (result.stdout ?? "").trim() };
}

function changesetPaths(range) {
  const output = git([
    "diff",
    "--name-only",
    "--diff-filter=A",
    range,
    "--",
    "database/canonical/changesets/*.json"
  ]).stdout;
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function readChangesets(ref, paths) {
  return paths.map((path) => {
    const output = git(["show", `${ref}:${path}`]).stdout;
    return JSON.parse(output);
  });
}

export function publicationConflicts(localChangesets, remoteChangesets) {
  const left = localChangesets.flatMap((item) => item.changes ?? []);
  const right = remoteChangesets.flatMap((item) => item.changes ?? []);
  return detectChangeConflicts(left, right);
}

async function main() {
  if (git(["status", "--porcelain"]).stdout) {
    throw new Error("Working tree must be clean before canonical rebase.");
  }
  git(["fetch", "--quiet", "origin", canonicalBranch]);
  if (
    git(["merge-base", "--is-ancestor", remoteRef, "HEAD"], { allowFailure: true }).status === 0
  ) {
    console.log("CANONICAL_REBASE=NOOP already-current");
    return;
  }

  const mergeBase = git(["merge-base", remoteRef, "HEAD"]).stdout;
  const localPaths = changesetPaths(`${mergeBase}..HEAD`);
  const remotePaths = changesetPaths(`${mergeBase}..${remoteRef}`);
  const local = readChangesets("HEAD", localPaths);
  const remote = readChangesets(remoteRef, remotePaths);
  const conflicts = publicationConflicts(local, remote);
  if (conflicts.length) {
    for (const conflict of conflicts) {
      console.error(`BLOCK: canonical conflict ${conflict.table}/${conflict.id}/${conflict.field}`);
    }
    throw new Error("Same-record/same-field canonical conflict requires explicit review.");
  }

  const result = git(["rebase", remoteRef], { allowFailure: true, inherit: true });
  if (result.status !== 0) {
    throw new Error("Git rebase stopped; resolve non-canonical textual conflicts and retry.");
  }
  console.log(
    `CANONICAL_REBASE=PASS localChangesets=${local.length} remoteChangesets=${remote.length} conflicts=0`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("CANONICAL_REBASE=BLOCKED");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
