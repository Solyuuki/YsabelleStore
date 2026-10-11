#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  createChangeset,
  inspectChangeset,
  mergeNonOverlappingChanges
} from "./canonical-changeset.mjs";
import { evaluatePushPolicy } from "./canonical-push-guard.mjs";
import { publicationConflicts } from "./canonical-rebase.mjs";

function change(field, after) {
  return {
    table: "products",
    id: "product-1",
    field,
    beforePresent: true,
    before: "base",
    afterPresent: true,
    after
  };
}

const baseSnapshot = {
  formatVersion: 1,
  tables: { products: { "product-1": { id: "product-1", name: "base", description: "base" } } }
};
const targetSnapshot = structuredClone(baseSnapshot);
targetSnapshot.tables.products["product-1"].name = "local";
const state = { releaseId: "g2-s2-c2-a2", catalogVersion: 2, assetVersion: 2 };
const changeset = createChangeset({
  baseCommit: "a".repeat(40),
  baseState: state,
  targetState: { ...state, catalogVersion: 3 },
  baseSnapshot,
  targetSnapshot
});
assert.deepEqual(
  changeset,
  createChangeset({
    baseCommit: "a".repeat(40),
    baseState: state,
    targetState: { ...state, catalogVersion: 3 },
    baseSnapshot,
    targetSnapshot
  })
);

assert.equal(
  mergeNonOverlappingChanges([change("name", "left")], [change("description", "right")]).length,
  2
);
assert.equal(
  publicationConflicts(
    [{ changes: [change("name", "left")] }],
    [{ changes: [change("name", "right")] }]
  ).length,
  1
);

const privateChangeset = structuredClone(changeset);
privateChangeset.changes[0].table = "users";
assert.ok(
  inspectChangeset(privateChangeset, {
    canonicalTables: ["products"],
    excludedRuntimeTables: ["users"]
  }).some((item) => item.includes("runtime/private"))
);

const baseState = {
  schemaVersion: 2,
  catalogVersion: 2,
  assetVersion: 2,
  canonicalCatalogPath: "database/seed/canonical-catalog-v1.sql",
  canonicalProductImageRoot: "database/canonical/product-images/sources",
  productAssetManifestPath: "database/prisma/state/product-assets.manifest.json",
  canonicalReleasePath: "database/canonical/releases/g2-s2-c2-a2.json"
};
const checksums = { migrations: { "0000_generation2_baseline": "frozen" } };
const missingBundle = evaluatePushPolicy({
  changed: ["database/canonical/product-images/sources/P001.jpg"],
  localState: { ...baseState, assetVersion: 3 },
  remoteState: baseState,
  localChecksums: checksums,
  remoteChecksums: checksums
});
assert.ok(missingBundle.some((item) => item.includes("image publication bundle")));

const completeBundle = evaluatePushPolicy({
  changed: [
    "database/canonical/product-images/sources/P001.jpg",
    "database/prisma/state/canonical-state.json",
    "database/prisma/state/product-assets.manifest.json",
    "database/canonical/releases/g2-s2-c3-a3.json",
    "database/canonical/product-images/candidate-reconciliation.json",
    "database/canonical/product-images/runtime-distribution.manifest.json",
    "database/canonical/product-images/runtime-distribution.files.tsv.gz",
    "database/canonical/changesets/cs-aaaaaaaaaaaaaaaaaaaa.json"
  ],
  localState: { ...baseState, catalogVersion: 3, assetVersion: 3 },
  remoteState: baseState,
  localChecksums: checksums,
  remoteChecksums: checksums
});
assert.equal(completeBundle.length, 0);

console.log(
  "PHASE5_PUBLICATION_REHEARSAL=PASS deterministic=1 nonOverlap=merge conflict=blocked private=blocked imageBundle=guarded"
);
