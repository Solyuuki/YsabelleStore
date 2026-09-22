import assert from "node:assert/strict";
import test from "node:test";

import {
  createChangeset,
  detectChangeConflicts,
  inspectChangeset,
  mergeNonOverlappingChanges
} from "../canonical-changeset.mjs";

const state = {
  releaseId: "g2-test",
  catalogVersion: 2,
  assetVersion: 2
};
const base = {
  formatVersion: 1,
  tables: {
    products: {
      p1: { id: "p1", name: "One", description: "Base" }
    }
  }
};

test("canonical changesets are deterministic and keyed by stable table/id/field identity", () => {
  const target = structuredClone(base);
  target.tables.products.p1.name = "One updated";
  const args = {
    baseCommit: "a".repeat(40),
    baseState: state,
    targetState: { ...state, catalogVersion: 3 },
    baseSnapshot: base,
    targetSnapshot: target
  };
  assert.deepEqual(createChangeset(args), createChangeset(args));
  assert.deepEqual(
    createChangeset(args).changes.map((item) => [item.table, item.id, item.field]),
    [["products", "p1", "name"]]
  );
});

test("non-overlapping developer changes merge deterministically", () => {
  const left = [
    {
      table: "products",
      id: "p1",
      field: "name",
      beforePresent: true,
      before: "One",
      afterPresent: true,
      after: "Left"
    }
  ];
  const right = [
    {
      table: "products",
      id: "p1",
      field: "description",
      beforePresent: true,
      before: "Base",
      afterPresent: true,
      after: "Right"
    }
  ];
  assert.equal(detectChangeConflicts(left, right).length, 0);
  assert.equal(mergeNonOverlappingChanges(left, right).length, 2);
});

test("same-record same-field disagreement is an explicit conflict", () => {
  const left = [
    {
      table: "products",
      id: "p1",
      field: "name",
      beforePresent: true,
      before: "One",
      afterPresent: true,
      after: "Left"
    }
  ];
  const right = [{ ...left[0], after: "Right" }];
  assert.equal(detectChangeConflicts(left, right).length, 1);
  assert.throws(() => mergeNonOverlappingChanges(left, right), /conflict/i);
});

test("runtime and private tables can never enter the canonical changeset pipeline", () => {
  const target = structuredClone(base);
  target.tables.products.p1.name = "Changed";
  const changeset = createChangeset({
    baseCommit: "b".repeat(40),
    baseState: state,
    targetState: { ...state, catalogVersion: 3 },
    baseSnapshot: base,
    targetSnapshot: target
  });
  changeset.changes[0].table = "users";
  const findings = inspectChangeset(changeset, {
    canonicalTables: ["products"],
    excludedRuntimeTables: ["users"]
  });
  assert.ok(findings.some((item) => item.includes("outside canonical scope")));
  assert.ok(findings.some((item) => item.includes("runtime/private")));
});
