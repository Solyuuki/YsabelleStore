import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePushPolicy } from "../canonical-push-guard.mjs";

const baseState = {
  schemaVersion: 3,
  catalogVersion: 5,
  assetVersion: 7,
  canonicalCatalogPath: "database/seed/canonical-catalog-v1.sql",
  productAssetManifestPath: "database/prisma/state/product-assets.manifest.json"
};

const checksums = {
  migrations: {
    "0000_generation2_baseline": "frozen"
  }
};

test("unrelated code changes do not require canonical version bumps", () => {
  assert.deepEqual(
    evaluatePushPolicy({
      changed: ["frontend/src/App.tsx"],
      localState: baseState,
      remoteState: baseState,
      localChecksums: checksums,
      remoteChecksums: checksums
    }),
    []
  );
});

test("schema changes require a schema version increase", () => {
  const findings = evaluatePushPolicy({
    changed: ["database/prisma/schema.prisma"],
    localState: baseState,
    remoteState: baseState,
    localChecksums: checksums,
    remoteChecksums: checksums
  });
  assert.ok(findings.some((item) => item.includes("schema/migration state")));
});

test("asset changes require an asset version increase", () => {
  const findings = evaluatePushPolicy({
    changed: ["frontend/public/images/products/example.webp"],
    localState: baseState,
    remoteState: baseState,
    localChecksums: checksums,
    remoteChecksums: checksums
  });
  assert.ok(findings.some((item) => item.includes("product asset state")));
});

test("frozen remote migration checksum cannot be rewritten", () => {
  const findings = evaluatePushPolicy({
    changed: ["database/prisma/state/migration-checksums.json"],
    localState: baseState,
    remoteState: baseState,
    localChecksums: { migrations: { "0000_generation2_baseline": "changed" } },
    remoteChecksums: checksums
  });
  assert.ok(findings.some((item) => item.includes("frozen remote migration")));
});

test("legacy archive is immutable", () => {
  const findings = evaluatePushPolicy({
    changed: ["database/prisma/migration-history-archive/generation-1/x/migration.sql"],
    localState: baseState,
    remoteState: baseState,
    localChecksums: checksums,
    remoteChecksums: checksums
  });
  assert.ok(findings.some((item) => item.includes("read-only")));
});

test("legacy archive fingerprint registry is immutable", () => {
  const findings = evaluatePushPolicy({
    changed: ["database/prisma/state/legacy-migration-blobs.json"],
    localState: baseState,
    remoteState: baseState,
    localChecksums: checksums,
    remoteChecksums: checksums
  });
  assert.ok(findings.some((item) => item.includes("fingerprint registry")));
});
