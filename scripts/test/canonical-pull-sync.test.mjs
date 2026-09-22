import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyDatabaseState,
  isRelevantCanonicalPath,
  requiresPrismaRegeneration
} from "../canonical-pull-sync.mjs";

const target = {
  migrationEpoch: 2,
  schemaVersion: 2,
  catalogVersion: 1,
  assetVersion: 1
};

test("canonical pull path detection ignores ordinary source changes", () => {
  assert.equal(isRelevantCanonicalPath("frontend/src/App.tsx"), false);
  assert.equal(isRelevantCanonicalPath("database/prisma/schema.prisma"), true);
  assert.equal(isRelevantCanonicalPath("frontend/public/images/products/example.webp"), true);
});

test("Prisma regeneration is required only when schema lineage changes", () => {
  const state = { schemaPath: "database/prisma/schema.prisma" };
  assert.equal(requiresPrismaRegeneration(["database/prisma/schema.prisma"], state), true);
  assert.equal(
    requiresPrismaRegeneration(
      ["database/prisma/migrations/0002_example/migration.sql"],
      state
    ),
    true
  );
  assert.equal(
    requiresPrismaRegeneration(["database/canonical/releases/g2-s2-c2-a2.json"], state),
    false
  );
});

test("empty database is classified separately", () => {
  assert.equal(
    classifyDatabaseState({
      applicationTableCount: 0,
      hasGeneration2Baseline: false,
      marker: null,
      target
    }),
    "EMPTY"
  );
});

test("legacy populated database does not masquerade as Generation 2", () => {
  assert.equal(
    classifyDatabaseState({
      applicationTableCount: 42,
      hasGeneration2Baseline: false,
      marker: null,
      target
    }),
    "LEGACY"
  );
});

test("pre-marker Generation 2 database is safe for additive migrate deploy", () => {
  assert.equal(
    classifyDatabaseState({
      applicationTableCount: 42,
      hasGeneration2Baseline: true,
      marker: null,
      target
    }),
    "GEN2_PRE_MARKER"
  );
});

test("ahead and wrong-epoch databases fail closed", () => {
  assert.equal(
    classifyDatabaseState({
      applicationTableCount: 43,
      hasGeneration2Baseline: true,
      marker: { migrationEpoch: 2, schemaVersion: 3, catalogVersion: 1, assetVersion: 1 },
      target
    }),
    "AHEAD"
  );
  assert.equal(
    classifyDatabaseState({
      applicationTableCount: 43,
      hasGeneration2Baseline: true,
      marker: { migrationEpoch: 1, schemaVersion: 2, catalogVersion: 1, assetVersion: 1 },
      target
    }),
    "DRIFTED"
  );
});
