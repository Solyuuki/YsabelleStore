#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expectedImageAssetId } from "./canonical-release-security.mjs";

const ROOT = resolve(".");
const STATE_PATH = "database/prisma/state/canonical-state.json";
const RECONCILIATION_PATH = "database/canonical/product-images/candidate-reconciliation.json";
const CATALOG_SQL_PATH = "database/seed/canonical-catalog-v1.sql";
const EXPECTED_ARCHIVE_SHA256 = "32340edb5e8442e8aa467b10df8377fba800b6e9cf27a4ed74aae4b8a50e6862";

function readJson(root, path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

export function inspectCandidateReconciliation({ state, release, reconciliation, catalogSql }) {
  const findings = [];

  if (reconciliation.formatVersion !== 1) {
    findings.push("BLOCK: candidate reconciliation formatVersion must be 1.");
  }
  if (
    reconciliation.releaseId !== release.releaseId ||
    reconciliation.releaseId !== state.releaseId
  ) {
    findings.push(
      "BLOCK: candidate reconciliation releaseId differs from canonical release/state."
    );
  }

  const corpus = reconciliation.sourceCorpus ?? {};
  if (corpus.archiveName !== "candidates.zip") {
    findings.push("BLOCK: candidate reconciliation archive name is invalid.");
  }
  if (corpus.archiveSha256 !== EXPECTED_ARCHIVE_SHA256) {
    findings.push("BLOCK: candidate reconciliation archive SHA-256 is invalid.");
  }
  if (
    corpus.zipEntriesObserved !== 2569 ||
    corpus.candidateDirectoriesObserved !== 428 ||
    corpus.completeCandidateDirectoriesObserved !== 428
  ) {
    findings.push("BLOCK: candidate reconciliation corpus counts are invalid.");
  }

  if (reconciliation.matchedProducts !== 50 || reconciliation.items?.length !== 50) {
    findings.push("BLOCK: candidate reconciliation must cover exactly 50 products.");
  }
  if (reconciliation.activeApprovedMatches !== 43) {
    findings.push("BLOCK: candidate reconciliation must contain 43 active approved matches.");
  }
  if (reconciliation.unselectedNeedsReviewMatches !== 7) {
    findings.push(
      "BLOCK: candidate reconciliation must contain 7 unselected needs-review matches."
    );
  }
  if (reconciliation.processedPayloadPinned !== true) {
    findings.push(
      "BLOCK: processed payload must be pinned once the runtime distribution manifest exists."
    );
  }
  if (reconciliation.distributionPayloadReady !== false) {
    findings.push(
      "BLOCK: distribution payload must remain not-ready during reconciliation checkpoint."
    );
  }

  const releaseByCode = new Map(
    (release.products ?? []).map((product) => [product.sourceProductId, product])
  );
  const seenCodes = new Set();
  const seenCandidates = new Set();
  let activeCount = 0;
  let reviewCount = 0;

  for (const item of reconciliation.items ?? []) {
    const product = releaseByCode.get(item.sourceProductId);
    if (!product) {
      findings.push(
        `BLOCK: reconciled product is not present in canonical release: ${item.sourceProductId}.`
      );
      continue;
    }

    if (seenCodes.has(item.sourceProductId)) {
      findings.push(`BLOCK: duplicate reconciled product: ${item.sourceProductId}.`);
    }
    seenCodes.add(item.sourceProductId);

    if (seenCandidates.has(item.candidateId)) {
      findings.push(`BLOCK: duplicate reconciled candidate: ${item.candidateId}.`);
    }
    seenCandidates.add(item.candidateId);

    const expectedId = expectedImageAssetId(item.sourceProductId, product.sourceImage.driveFileId);
    if (item.candidateId !== expectedId) {
      findings.push(
        `BLOCK: ${item.sourceProductId} candidate id differs from pinned Drive identity.`
      );
    }

    const sourceExtension = extname(product.sourceImage.path).slice(1).toLowerCase();
    if (item.originalExtension !== sourceExtension) {
      findings.push(
        `BLOCK: ${item.sourceProductId} reconciled original extension differs from canonical source.`
      );
    }
    if (Number(item.originalSizeBytes) !== Number(product.sourceImage.sizeBytes)) {
      findings.push(
        `BLOCK: ${item.sourceProductId} reconciled original size differs from canonical source.`
      );
    }
    if (item.originalGitBlobOid !== product.sourceImage.gitBlobOid) {
      findings.push(
        `BLOCK: ${item.sourceProductId} reconciled original bytes differ from canonical source.`
      );
    }

    const activeId = product.catalogImage?.activeImageAssetId ?? null;
    if (activeId) {
      activeCount += 1;
      if (item.catalogBinding !== "ACTIVE_APPROVED") {
        findings.push(
          `BLOCK: ${item.sourceProductId} active image must be marked ACTIVE_APPROVED.`
        );
      }
      if (item.candidateId !== activeId) {
        findings.push(
          `BLOCK: ${item.sourceProductId} reconciled candidate differs from active image asset.`
        );
      }
      const sqlNeedle = `('${item.candidateId}','${product.productId}','APPROVED','READY'`;
      if (!catalogSql.includes(sqlNeedle)) {
        findings.push(
          `BLOCK: ${item.sourceProductId} active candidate is missing APPROVED/READY seed evidence.`
        );
      }
    } else {
      reviewCount += 1;
      if (item.catalogBinding !== "UNSELECTED_NEEDS_REVIEW") {
        findings.push(
          `BLOCK: ${item.sourceProductId} unselected image must be marked UNSELECTED_NEEDS_REVIEW.`
        );
      }
      if (!product.catalogImage?.legacyImageUrl) {
        findings.push(`BLOCK: ${item.sourceProductId} has no active image and no legacy fallback.`);
      }
      const sqlNeedle = `('${item.candidateId}','${product.productId}','NEEDS_REVIEW','READY'`;
      if (!catalogSql.includes(sqlNeedle)) {
        findings.push(
          `BLOCK: ${item.sourceProductId} candidate is missing NEEDS_REVIEW/READY seed evidence.`
        );
      }
    }
  }

  if (seenCodes.size !== release.products?.length) {
    findings.push("BLOCK: candidate reconciliation does not cover the full canonical release.");
  }
  if (activeCount !== reconciliation.activeApprovedMatches) {
    findings.push("BLOCK: active approved reconciliation count does not match manifest metadata.");
  }
  if (reviewCount !== reconciliation.unselectedNeedsReviewMatches) {
    findings.push("BLOCK: needs-review reconciliation count does not match manifest metadata.");
  }

  return findings;
}

export function inspectRepository(root = ROOT) {
  const state = readJson(root, STATE_PATH);
  const release = readJson(root, state.canonicalReleasePath);
  const reconciliation = readJson(root, RECONCILIATION_PATH);
  const catalogSql = readFileSync(join(root, CATALOG_SQL_PATH), "utf8");
  return inspectCandidateReconciliation({
    state,
    release,
    reconciliation,
    catalogSql
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = inspectRepository();
  if (findings.length > 0) {
    for (const finding of findings) console.error(finding);
    console.error(`CANDIDATE_RECONCILIATION_SECURITY=BLOCKED (${findings.length} findings)`);
    process.exitCode = 1;
  } else {
    const reconciliation = JSON.parse(readFileSync(RECONCILIATION_PATH, "utf8"));
    console.log(
      `CANDIDATE_RECONCILIATION_SECURITY=PASS matched=${reconciliation.matchedProducts} active=${reconciliation.activeApprovedMatches} review=${reconciliation.unselectedNeedsReviewMatches}`
    );
  }
}
