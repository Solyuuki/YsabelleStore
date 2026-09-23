#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inspectChangeset } from "./canonical-changeset.mjs";

const ROOT = resolve(".");
const STATE_PATH = join(ROOT, "database", "prisma", "state", "canonical-state.json");
const CHANGESET_ROOT = join(ROOT, "database", "canonical", "changesets");

export function inspectChangesetDirectory(root = ROOT) {
  const findings = [];
  const state = JSON.parse(
    readFileSync(join(root, "database/prisma/state/canonical-state.json"), "utf8")
  );
  const release = JSON.parse(readFileSync(join(root, state.canonicalReleasePath), "utf8"));
  const directory = join(root, "database/canonical/changesets");
  if (!existsSync(directory)) return findings;

  for (const name of readdirSync(directory)
    .filter((item) => item.endsWith(".json"))
    .sort()) {
    const path = join(directory, name);
    let changeset;
    try {
      changeset = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      findings.push("BLOCK: invalid canonical changeset JSON: " + name + ".");
      continue;
    }
    for (const finding of inspectChangeset(changeset, {
      canonicalTables: release.canonicalTables,
      excludedRuntimeTables: release.excludedRuntimeTables
    })) {
      findings.push(name + ": " + finding);
    }
    if (name !== changeset.changesetId + ".json") {
      findings.push(
        "BLOCK: changeset filename must equal deterministic changesetId: " + name + "."
      );
    }
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = inspectChangesetDirectory();
  if (findings.length) {
    for (const finding of findings) console.error(finding);
    console.error("CANONICAL_CHANGESET_SECURITY=BLOCKED (" + findings.length + " findings)");
    process.exitCode = 1;
  } else {
    const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    console.log(
      "CANONICAL_CHANGESET_SECURITY=PASS release=" + state.releaseId + " root=" + CHANGESET_ROOT
    );
  }
}
