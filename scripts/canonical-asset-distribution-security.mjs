#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(".");
const STATE_PATH = "database/prisma/state/canonical-state.json";
const RECONCILIATION_PATH = "database/canonical/product-images/candidate-reconciliation.json";
const DISTRIBUTION_PATH = "database/canonical/product-images/runtime-distribution.manifest.json";
const SHA256_HEX = /^[0-9a-f]{64}$/;
const GIT_BLOB_HEX = /^[0-9a-f]{40}$/;
const REQUIRED_ROLES = ["original", "processed", "card", "pdp"];

function readJson(root, path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseRecords(text) {
  const lines = text.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const header = lines.shift();
  if (header !== "candidateId\trole\tsizeBytes\tsha256\tgitBlobOid") {
    return { records: [], headerValid: false };
  }
  const records = lines.filter(Boolean).map((line) => {
    const [candidateId, role, sizeBytes, fileSha256, gitBlobOid] = line.split("\t");
    return {
      candidateId,
      role,
      sizeBytes: Number(sizeBytes),
      sha256: fileSha256,
      gitBlobOid
    };
  });
  return { records, headerValid: true };
}

function runtimePath(candidateId, originalExtension, role) {
  if (role === "original") return `candidates/${candidateId}/original.${originalExtension}`;
  if (role === "processed") return `candidates/${candidateId}/processed/processed.webp`;
  if (role === "card") return `candidates/${candidateId}/processed/card.webp`;
  return `candidates/${candidateId}/processed/pdp.webp`;
}

function payloadDigest(records, reconciliationByCandidate) {
  const rows = [];
  for (const record of records) {
    const item = reconciliationByCandidate.get(record.candidateId);
    if (!item) continue;
    rows.push(
      [
        item.sourceProductId,
        record.candidateId,
        record.role,
        runtimePath(record.candidateId, item.originalExtension, record.role),
        record.sizeBytes,
        record.sha256,
        record.gitBlobOid
      ].join("|")
    );
  }
  return sha256(rows.sort().join("\n"));
}

export function inspectAssetDistribution({
  state,
  release,
  reconciliation,
  distribution,
  recordsText
}) {
  const findings = [];
  const parsed = parseRecords(recordsText);

  if (distribution.formatVersion !== 1) {
    findings.push("BLOCK: runtime distribution manifest formatVersion must be 1.");
  }
  if (
    distribution.releaseId !== state.releaseId ||
    distribution.releaseId !== release.releaseId ||
    distribution.releaseId !== reconciliation.releaseId
  ) {
    findings.push("BLOCK: runtime distribution releaseId differs from canonical state/release.");
  }
  if (distribution.assetVersion !== state.assetVersion) {
    findings.push("BLOCK: runtime distribution assetVersion differs from canonical state.");
  }

  const corpus = distribution.sourceCorpus ?? {};
  const reconciledCorpus = reconciliation.sourceCorpus ?? {};
  for (const key of [
    "archiveName",
    "archiveSha256",
    "zipEntriesObserved",
    "candidateDirectoriesObserved",
    "completeCandidateDirectoriesObserved"
  ]) {
    if (corpus[key] !== reconciledCorpus[key]) {
      findings.push(`BLOCK: runtime distribution source corpus differs for ${key}.`);
    }
  }

  if (
    distribution.recordsPath !==
    "database/canonical/product-images/runtime-distribution.files.tsv.gz"
  ) {
    findings.push("BLOCK: runtime distribution records path is invalid.");
  }
  if (distribution.recordsEncoding !== "gzip") {
    findings.push("BLOCK: runtime distribution records encoding must be gzip.");
  }
  if (sha256(recordsText.replace(/\r\n/g, "\n")) !== distribution.recordsSha256) {
    findings.push("BLOCK: runtime distribution records checksum is invalid.");
  }
  if (!parsed.headerValid) {
    findings.push("BLOCK: runtime distribution records header is invalid.");
  }
  if (distribution.target?.runtimeRoot !== "%LOCALAPPDATA%\\YsabelleStore\\catalog-images") {
    findings.push("BLOCK: runtime distribution root is not the Ysabelle catalog-images directory.");
  }
  if (distribution.target?.candidateRoot !== "candidates") {
    findings.push("BLOCK: runtime distribution candidate root must be candidates.");
  }

  if (distribution.candidateCount !== 50 || reconciliation.items?.length !== 50) {
    findings.push("BLOCK: runtime distribution must cover exactly 50 candidates.");
  }
  if (distribution.filesPerCandidate !== 4 || distribution.payloadFileCount !== 200) {
    findings.push("BLOCK: runtime distribution must pin exactly four files for each candidate.");
  }
  if (distribution.processedPayloadPinned !== true) {
    findings.push("BLOCK: runtime processed payload must be integrity-pinned.");
  }
  if (reconciliation.processedPayloadPinned !== true) {
    findings.push("BLOCK: candidate reconciliation does not acknowledge the pinned payload.");
  }
  if (distribution.distributionPayloadReady !== state.distributionReady) {
    findings.push("BLOCK: runtime distribution readiness differs from canonical state.");
  }
  if (state.distributionReady) {
    if (distribution.reconstruction?.exactByteRehearsalPassed !== true) {
      findings.push("BLOCK: ready distribution requires a recorded exact-byte rehearsal pass.");
    }
    if ((distribution.distributionBlockers ?? []).length !== 0) {
      findings.push("BLOCK: ready distribution cannot retain distribution blockers.");
    }
  } else if ((distribution.distributionBlockers ?? []).length === 0) {
    findings.push("BLOCK: unready distribution must document its remaining blocker.");
  }

  const reconstruction = distribution.reconstruction ?? {};
  if (distribution.payloadMode !== "GIT_RECONSTRUCTED_EXACT_BYTES") {
    findings.push("BLOCK: runtime payload mode must use exact-byte Git reconstruction.");
  }
  if (reconstruction.engineBatchPath !== "catalog-image-engine/app/batch.py") {
    findings.push("BLOCK: runtime reconstruction engine path is invalid.");
  }
  if (reconstruction.pythonRequirementsPath !== "catalog-image-engine/requirements.txt") {
    findings.push("BLOCK: runtime reconstruction requirements path is invalid.");
  }
  if (reconstruction.pillowVersion !== "12.3.0") {
    findings.push("BLOCK: runtime reconstruction Pillow version must be pinned to 12.3.0.");
  }
  if (reconstruction.sourceRoot !== state.canonicalProductImageRoot) {
    findings.push("BLOCK: runtime reconstruction source root differs from canonical state.");
  }
  if (reconstruction.processedCardAliasPolicy !== "MANIFEST_IDENTICAL_IDENTITY") {
    findings.push("BLOCK: processed/card alias policy is invalid.");
  }
  if (!existsSync(join(ROOT, reconstruction.engineBatchPath ?? ""))) {
    findings.push("BLOCK: runtime reconstruction engine is missing.");
  }
  const requirementsPath = join(ROOT, reconstruction.pythonRequirementsPath ?? "");
  if (
    !existsSync(requirementsPath) ||
    readFileSync(requirementsPath, "utf8").trim() !== "Pillow==12.3.0"
  ) {
    findings.push("BLOCK: Pillow must be exactly pinned for byte-stable runtime reconstruction.");
  }

  const reconciliationByCandidate = new Map(
    (reconciliation.items ?? []).map((item) => [item.candidateId, item])
  );
  const releaseByCode = new Map(
    (release.products ?? []).map((product) => [product.sourceProductId, product])
  );
  const rolesByCandidate = new Map();
  const seenRecordKeys = new Set();
  let payloadBytes = 0;

  for (const record of parsed.records) {
    const item = reconciliationByCandidate.get(record.candidateId);
    if (!item) {
      findings.push(
        `BLOCK: runtime distribution contains unknown candidate ${record.candidateId}.`
      );
      continue;
    }
    const product = releaseByCode.get(item.sourceProductId);
    if (!product) {
      findings.push(
        `BLOCK: runtime distribution contains unknown product ${item.sourceProductId}.`
      );
      continue;
    }

    const key = `${record.candidateId}:${record.role}`;
    if (seenRecordKeys.has(key)) {
      findings.push(`BLOCK: duplicate runtime distribution record ${key}.`);
    }
    seenRecordKeys.add(key);

    if (!REQUIRED_ROLES.includes(record.role)) {
      findings.push(`BLOCK: ${record.candidateId} has invalid runtime role ${record.role}.`);
      continue;
    }
    const roles = rolesByCandidate.get(record.candidateId) ?? new Set();
    roles.add(record.role);
    rolesByCandidate.set(record.candidateId, roles);

    if (!Number.isInteger(record.sizeBytes) || record.sizeBytes <= 0) {
      findings.push(`BLOCK: ${record.candidateId} ${record.role} has invalid byte size.`);
    }
    if (!SHA256_HEX.test(record.sha256 ?? "")) {
      findings.push(`BLOCK: ${record.candidateId} ${record.role} has invalid SHA-256.`);
    }
    if (!GIT_BLOB_HEX.test(record.gitBlobOid ?? "")) {
      findings.push(`BLOCK: ${record.candidateId} ${record.role} has invalid Git blob OID.`);
    }

    if (record.role === "original") {
      const sourceExtension = extname(product.sourceImage.path).slice(1).toLowerCase();
      if (item.originalExtension !== sourceExtension) {
        findings.push(`BLOCK: ${item.sourceProductId} original extension differs from release.`);
      }
      if (Number(record.sizeBytes) !== Number(item.originalSizeBytes)) {
        findings.push(`BLOCK: ${item.sourceProductId} original size differs from reconciliation.`);
      }
      if (record.gitBlobOid !== item.originalGitBlobOid) {
        findings.push(`BLOCK: ${item.sourceProductId} original bytes differ from reconciliation.`);
      }
      if (record.gitBlobOid !== product.sourceImage.gitBlobOid) {
        findings.push(
          `BLOCK: ${item.sourceProductId} original bytes differ from canonical source.`
        );
      }
    }

    payloadBytes += Number(record.sizeBytes) || 0;
  }

  for (const item of reconciliation.items ?? []) {
    const roles = rolesByCandidate.get(item.candidateId) ?? new Set();
    for (const role of REQUIRED_ROLES) {
      if (!roles.has(role)) {
        findings.push(`BLOCK: ${item.sourceProductId} is missing runtime role ${role}.`);
      }
    }
  }

  if (parsed.records.length !== distribution.payloadFileCount) {
    findings.push("BLOCK: runtime distribution file count differs from manifest metadata.");
  }
  if (payloadBytes !== distribution.payloadByteCount) {
    findings.push("BLOCK: runtime distribution byte count differs from manifest metadata.");
  }
  if (payloadDigest(parsed.records, reconciliationByCandidate) !== distribution.payloadSha256) {
    findings.push("BLOCK: runtime distribution aggregate payload digest is invalid.");
  }

  const recordMap = new Map(
    parsed.records.map((record) => [record.candidateId + ":" + record.role, record])
  );
  let aliasCount = 0;
  for (const item of reconciliation.items ?? []) {
    const processed = recordMap.get(item.candidateId + ":processed");
    const card = recordMap.get(item.candidateId + ":card");
    if (
      processed &&
      card &&
      processed.sizeBytes === card.sizeBytes &&
      processed.sha256 === card.sha256 &&
      processed.gitBlobOid === card.gitBlobOid
    ) {
      aliasCount += 1;
    }
  }
  if (aliasCount !== 16 || reconstruction.processedCardAliasCount !== 16) {
    findings.push(
      "BLOCK: runtime reconstruction must account for exactly 16 processed/card aliases."
    );
  }

  return findings;
}

export function inspectRepository(root = ROOT) {
  const state = readJson(root, STATE_PATH);
  const release = readJson(root, state.canonicalReleasePath);
  const reconciliation = readJson(root, RECONCILIATION_PATH);
  const distribution = readJson(root, DISTRIBUTION_PATH);
  const recordsCompressed = readFileSync(join(root, distribution.recordsPath));
  if (sha256(recordsCompressed) !== distribution.recordsCompressedSha256) {
    return ["BLOCK: compressed runtime distribution records checksum is invalid."];
  }
  const recordsText = gunzipSync(recordsCompressed).toString("utf8");
  return inspectAssetDistribution({ state, release, reconciliation, distribution, recordsText });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = inspectRepository();
  if (findings.length > 0) {
    for (const finding of findings) console.error(finding);
    console.error(`ASSET_DISTRIBUTION_SECURITY=BLOCKED (${findings.length} findings)`);
    process.exitCode = 1;
  } else {
    const distribution = JSON.parse(readFileSync(DISTRIBUTION_PATH, "utf8"));
    console.log(
      `ASSET_DISTRIBUTION_SECURITY=PASS candidates=${distribution.candidateCount} ` +
        `files=${distribution.payloadFileCount} bytes=${distribution.payloadByteCount}`
    );
  }
}
