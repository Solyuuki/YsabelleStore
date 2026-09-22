import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  gitBlobOid,
  materializeAssetPayload,
  sha256,
  verifyMaterializationSide
} from "../canonical-asset-materializer.mjs";

function record(candidateId, role, bytes) {
  return [
    candidateId,
    role,
    String(bytes.length),
    sha256(bytes),
    gitBlobOid(bytes)
  ].join("\t");
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ysabelle-asset-materialize-"));
  const payloadRoot = join(root, "payload");
  const runtimeRoot = join(root, "runtime");
  const candidateId = "sarima-p999-aaaaaaaaaaaa";
  const item = {
    sourceProductId: "P999",
    candidateId,
    originalExtension: "jpg"
  };
  const files = {
    original: Buffer.from("canonical-original"),
    processed: Buffer.from("canonical-processed"),
    card: Buffer.from("canonical-card"),
    pdp: Buffer.from("canonical-pdp")
  };

  for (const [role, bytes] of Object.entries(files)) {
    const relative =
      role === "original"
        ? join("candidates", candidateId, "original.jpg")
        : join(
            "candidates",
            candidateId,
            "processed",
            role === "processed" ? "processed.webp" : `${role}.webp`
          );
    const path = join(payloadRoot, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }

  const recordsText = [
    "candidateId\trole\tsizeBytes\tsha256\tgitBlobOid",
    record(candidateId, "original", files.original),
    record(candidateId, "processed", files.processed),
    record(candidateId, "card", files.card),
    record(candidateId, "pdp", files.pdp),
    ""
  ].join("\n");

  return {
    payloadRoot,
    runtimeRoot,
    reconciliation: { items: [item] },
    recordsText,
    candidateId,
    files
  };
}

test("asset materializer verifies, replaces, backs up, and becomes idempotent", () => {
  const fx = fixture();
  const oldPath = join(fx.runtimeRoot, "candidates", fx.candidateId, "processed", "card.webp");
  mkdirSync(dirname(oldPath), { recursive: true });
  writeFileSync(oldPath, Buffer.from("old-card"));

  const applied = materializeAssetPayload({
    reconciliation: fx.reconciliation,
    recordsText: fx.recordsText,
    payloadRoot: fx.payloadRoot,
    runtimeRoot: fx.runtimeRoot,
    releaseId: "g2-test"
  });

  assert.equal(applied.status, "APPLIED");
  assert.equal(applied.candidateCount, 1);
  assert.equal(applied.fileCount, 4);
  assert.ok(applied.backupRoot);
  assert.deepEqual(
    readFileSync(join(fx.runtimeRoot, "candidates", fx.candidateId, "processed", "card.webp")),
    fx.files.card
  );

  const noop = materializeAssetPayload({
    reconciliation: fx.reconciliation,
    recordsText: fx.recordsText,
    payloadRoot: fx.payloadRoot,
    runtimeRoot: fx.runtimeRoot,
    releaseId: "g2-test"
  });
  assert.equal(noop.status, "NOOP");
  assert.equal(noop.backupRoot, null);
});

test("asset materializer refuses bad source bytes before touching runtime files", () => {
  const fx = fixture();
  const sourceCard = join(
    fx.payloadRoot,
    "candidates",
    fx.candidateId,
    "processed",
    "card.webp"
  );
  writeFileSync(sourceCard, Buffer.from("tampered"));

  assert.throws(
    () =>
      materializeAssetPayload({
        reconciliation: fx.reconciliation,
        recordsText: fx.recordsText,
        payloadRoot: fx.payloadRoot,
        runtimeRoot: fx.runtimeRoot,
        releaseId: "g2-test"
      }),
    /failed verification before materialization/
  );

  const targetPlan = [
    {
      sourcePath: sourceCard,
      targetPath: join(fx.runtimeRoot, "candidates", fx.candidateId, "processed", "card.webp"),
      sizeBytes: fx.files.card.length,
      sha256: sha256(fx.files.card),
      gitBlobOid: gitBlobOid(fx.files.card)
    }
  ];
  assert.equal(verifyMaterializationSide(targetPlan, "target").length, 1);
});
