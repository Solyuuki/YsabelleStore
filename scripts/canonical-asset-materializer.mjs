#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync
} from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const STATE_PATH = "database/prisma/state/canonical-state.json";
const RECONCILIATION_PATH = "database/canonical/product-images/candidate-reconciliation.json";
const DISTRIBUTION_PATH = "database/canonical/product-images/runtime-distribution.manifest.json";
const DEFAULT_PAYLOAD_ROOT = "database/canonical/product-images/runtime-payload";
const REQUIRED_ROLES = ["original", "processed", "card", "pdp"];

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function gitBlobOid(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

export function parseDistributionRecords(text) {
  const lines = text.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const header = lines.shift();
  if (header !== "candidateId\trole\tsizeBytes\tsha256\tgitBlobOid") {
    throw new Error("Runtime distribution records header is invalid.");
  }

  return lines.filter(Boolean).map((line) => {
    const [candidateId, role, sizeBytes, fileSha256, blobOid] = line.split("\t");
    if (!candidateId || !REQUIRED_ROLES.includes(role)) {
      throw new Error(`Runtime distribution record is invalid: ${line}`);
    }
    return {
      candidateId,
      role,
      sizeBytes: Number(sizeBytes),
      sha256: fileSha256,
      gitBlobOid: blobOid
    };
  });
}

export function runtimeRelativePath(item, role) {
  if (!/^[a-z0-9-]+$/.test(item.candidateId)) {
    throw new Error(`Unsafe candidate id: ${item.candidateId}`);
  }

  if (role === "original") {
    const extension = String(item.originalExtension ?? "").toLowerCase();
    if (!/^[a-z0-9]+$/.test(extension)) {
      throw new Error(`Unsafe original extension for ${item.candidateId}.`);
    }
    return join("candidates", item.candidateId, `original.${extension}`);
  }
  if (role === "processed") {
    return join("candidates", item.candidateId, "processed", "processed.webp");
  }
  if (role === "card") {
    return join("candidates", item.candidateId, "processed", "card.webp");
  }
  if (role === "pdp") {
    return join("candidates", item.candidateId, "processed", "pdp.webp");
  }
  throw new Error(`Unsupported runtime asset role: ${role}`);
}

export function buildAssetMaterializationPlan({
  reconciliation,
  recordsText,
  payloadRoot,
  runtimeRoot
}) {
  const byCandidate = new Map(
    (reconciliation.items ?? []).map((item) => [item.candidateId, item])
  );
  const records = parseDistributionRecords(recordsText);
  return records.map((record) => {
    const item = byCandidate.get(record.candidateId);
    if (!item) {
      throw new Error(`Distribution references unknown candidate: ${record.candidateId}`);
    }
    const relativePath = runtimeRelativePath(item, record.role);
    return {
      ...record,
      relativePath,
      sourcePath: join(payloadRoot, relativePath),
      targetPath: join(runtimeRoot, relativePath)
    };
  });
}

function verifyFile(path, record) {
  if (!existsSync(path)) return `missing: ${path}`;
  const stats = statSync(path);
  if (!stats.isFile()) return `not a file: ${path}`;
  if (stats.size !== record.sizeBytes) return `size mismatch: ${path}`;

  const bytes = readFileSync(path);
  if (sha256(bytes) !== record.sha256) return `SHA-256 mismatch: ${path}`;
  if (gitBlobOid(bytes) !== record.gitBlobOid) return `Git blob mismatch: ${path}`;
  return null;
}

export function verifyMaterializationSide(plan, side) {
  const findings = [];
  for (const record of plan) {
    const path = side === "source" ? record.sourcePath : record.targetPath;
    const finding = verifyFile(path, record);
    if (finding) findings.push(finding);
  }
  return findings;
}

function uniqueCandidateIds(plan) {
  return [...new Set(plan.map((item) => item.candidateId))].sort();
}

export function materializeAssetPayload({
  reconciliation,
  recordsText,
  payloadRoot,
  runtimeRoot,
  releaseId
}) {
  const plan = buildAssetMaterializationPlan({
    reconciliation,
    recordsText,
    payloadRoot,
    runtimeRoot
  });

  const sourceFindings = verifyMaterializationSide(plan, "source");
  if (sourceFindings.length) {
    throw new Error(
      `Published runtime payload failed verification before materialization:\n${sourceFindings.join("\n")}`
    );
  }

  if (verifyMaterializationSide(plan, "target").length === 0) {
    return {
      status: "NOOP",
      candidateCount: uniqueCandidateIds(plan).length,
      fileCount: plan.length,
      backupRoot: null
    };
  }

  mkdirSync(runtimeRoot, { recursive: true });
  const safeRelease = String(releaseId ?? "unknown").replace(/[^a-zA-Z0-9._-]/g, "_");
  const stageRoot = join(runtimeRoot, `.canonical-stage-${safeRelease}-${process.pid}`);
  const backupRoot = join(runtimeRoot, ".canonical-backups", `${safeRelease}-${Date.now()}`);
  const swapped = [];

  rmSync(stageRoot, { recursive: true, force: true });

  try {
    for (const record of plan) {
      const stagedPath = join(stageRoot, record.relativePath);
      mkdirSync(dirname(stagedPath), { recursive: true });
      copyFileSync(record.sourcePath, stagedPath);
    }

    const stagePlan = plan.map((record) => ({
      ...record,
      targetPath: join(stageRoot, record.relativePath)
    }));
    const stageFindings = verifyMaterializationSide(stagePlan, "target");
    if (stageFindings.length) {
      throw new Error(`Staged runtime payload failed verification:\n${stageFindings.join("\n")}`);
    }

    for (const candidateId of uniqueCandidateIds(plan)) {
      const stagedCandidate = join(stageRoot, "candidates", candidateId);
      const targetCandidate = join(runtimeRoot, "candidates", candidateId);
      const backupCandidate = join(backupRoot, candidateId);

      mkdirSync(dirname(targetCandidate), { recursive: true });
      let backedUp = false;
      if (existsSync(targetCandidate)) {
        mkdirSync(dirname(backupCandidate), { recursive: true });
        renameSync(targetCandidate, backupCandidate);
        backedUp = true;
      }

      renameSync(stagedCandidate, targetCandidate);
      swapped.push({ targetCandidate, backupCandidate, backedUp });
    }

    const targetFindings = verifyMaterializationSide(plan, "target");
    if (targetFindings.length) {
      throw new Error(
        `Runtime payload failed verification after materialization:\n${targetFindings.join("\n")}`
      );
    }

    rmSync(stageRoot, { recursive: true, force: true });
    const keptBackup = swapped.some((item) => item.backedUp);
    if (!keptBackup) rmSync(backupRoot, { recursive: true, force: true });

    return {
      status: "APPLIED",
      candidateCount: uniqueCandidateIds(plan).length,
      fileCount: plan.length,
      backupRoot: keptBackup ? backupRoot : null
    };
  } catch (error) {
    for (const item of [...swapped].reverse()) {
      rmSync(item.targetCandidate, { recursive: true, force: true });
      if (item.backedUp && existsSync(item.backupCandidate)) {
        mkdirSync(dirname(item.targetCandidate), { recursive: true });
        renameSync(item.backupCandidate, item.targetCandidate);
      }
    }
    rmSync(stageRoot, { recursive: true, force: true });
    throw error;
  }
}

function resolveRuntimeRoot() {
  if (process.env.YSABELLE_CATALOG_IMAGE_ROOT) {
    return resolve(process.env.YSABELLE_CATALOG_IMAGE_ROOT);
  }
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, "YsabelleStore", "catalog-images");
  }
  throw new Error(
    "YSABELLE_CATALOG_IMAGE_ROOT is required outside Windows for canonical asset materialization."
  );
}

function main() {
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  const reconciliation = JSON.parse(readFileSync(RECONCILIATION_PATH, "utf8"));
  const distribution = JSON.parse(readFileSync(DISTRIBUTION_PATH, "utf8"));

  if (!distribution.distributionPayloadReady) {
    console.warn("CANONICAL_ASSET_MATERIALIZE=DEFERRED: physical payload is not published.");
    for (const blocker of distribution.distributionBlockers ?? []) {
      console.warn(`  - ${blocker}`);
    }
    return;
  }

  const recordsCompressed = readFileSync(distribution.recordsPath);
  const recordsText = gunzipSync(recordsCompressed).toString("utf8");
  const payloadRoot = resolve(distribution.payloadRoot ?? DEFAULT_PAYLOAD_ROOT);
  const runtimeRoot = resolveRuntimeRoot();

  const result = materializeAssetPayload({
    reconciliation,
    recordsText,
    payloadRoot,
    runtimeRoot,
    releaseId: state.releaseId
  });

  console.log(
    `CANONICAL_ASSET_MATERIALIZE=${result.status} candidates=${result.candidateCount} files=${result.fileCount}`
  );
  if (result.backupRoot) console.log(`CANONICAL_ASSET_BACKUP=${result.backupRoot}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error("CANONICAL_ASSET_MATERIALIZE=ERROR");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
