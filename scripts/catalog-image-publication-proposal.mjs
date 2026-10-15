#!/usr/bin/env node
// A read-only live audit with an optional operator-controlled media export.
// This command deliberately never mutates MySQL, Git, or a canonical manifest.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

import { resolveRuntimeRoot } from "./canonical-asset-materializer.mjs";
import {
  classifyRuntimeImageOverride,
  isRuntimeImageAssetId
} from "./canonical-runtime-image-overrides.mjs";

const root = resolve(".");
const keys = {
  original: "originalStorageKey",
  processed: "processedStorageKey",
  card: "cardStorageKey",
  pdp: "pdpStorageKey"
};

export function parseImagePublicationArgs(argv) {
  const find = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const sku = find("--sku");
  const productId = find("--product-id");
  const output = find("--output");
  if (Boolean(sku) === Boolean(productId)) {
    throw new Error("Specify exactly one of --sku or --product-id.");
  }
  if (argv.includes("--output") && !output) throw new Error("--output needs a directory.");
  if (output) {
    const absolute = resolve(output);
    const rel = relative(root, absolute);
    if (!rel || (!rel.startsWith("..") && !isAbsolute(rel))) {
      throw new Error(
        "Export outside the Git working tree; do not publish unreviewed runtime files."
      );
    }
    if (existsSync(absolute)) throw new Error("Export folder already exists; choose a new folder.");
  }
  return { sku, productId, output: output ? resolve(output) : null };
}

function fileDigest(buffer, algorithm) {
  return createHash(algorithm).update(buffer).digest("hex");
}

function gitBlobId(buffer) {
  return fileDigest(Buffer.concat([Buffer.from("blob " + buffer.length + "\0"), buffer]), "sha1");
}

function runtimeRow(product, asset) {
  return {
    id: product.id,
    active_image_asset_id: product.activeImageAssetId,
    image_url: product.imageUrl,
    asset_product_id: asset?.productId,
    quality_status: asset?.qualityStatus,
    processing_status: asset?.processingStatus,
    approved_at: asset?.approvedAt,
    superseded_at: asset?.supersededAt,
    original_storage_key: asset?.originalStorageKey,
    processed_storage_key: asset?.processedStorageKey,
    card_storage_key: asset?.cardStorageKey,
    pdp_storage_key: asset?.pdpStorageKey
  };
}

export function describeImagePublicationState({ product, latest, canonicalId }) {
  const activeId = product.activeImageAssetId;
  const latestId = latest?.id ?? null;
  const latestApprovedId =
    latest?.qualityStatus === "APPROVED" &&
    latest?.processingStatus === "READY" &&
    latest?.approvedAt
      ? latestId
      : null;
  return {
    productId: product.id,
    sku: product.sku,
    imageUrl: product.imageUrl,
    activeId,
    canonicalId,
    latestCandidateId: latestId,
    latestCandidateApproved: Boolean(latestApprovedId),
    activeMatchesLatest: activeId === latestId,
    activeIsCanonical: Boolean(canonicalId && activeId === canonicalId),
    expectedPdpUrl: activeId ? `/api/storefront/product-images/${activeId}/pdp` : null,
    possibleRollback: Boolean(latestApprovedId && activeId !== latestApprovedId)
  };
}

async function main() {
  const args = parseImagePublicationArgs(process.argv.slice(2));
  const db = new PrismaClient();
  try {
    const product = await db.product.findUnique({
      where: args.productId ? { id: args.productId } : { sku: args.sku },
      include: { activeImageAsset: true }
    });
    if (!product) throw new Error("Product not found.");
    const latest = await db.productImageAsset.findFirst({
      where: { productId: product.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    const state = JSON.parse(readFileSync("database/prisma/state/canonical-state.json", "utf8"));
    const release = JSON.parse(readFileSync(state.canonicalReleasePath, "utf8"));
    const canonicalId =
      release.products.find((entry) => entry.productId === product.id)?.catalogImage
        ?.activeImageAssetId ?? null;
    const report = describeImagePublicationState({ product, latest, canonicalId });
    console.log(JSON.stringify({ audit: report }, null, 2));

    if (!args.output) return;
    if (!product.activeImageAsset || !isRuntimeImageAssetId(product.activeImageAssetId)) {
      throw new Error("Only an active, new Owner-approved runtime image can be proposed.");
    }
    // Validates ownership, approval, public binding, and all four on-disk assets.
    classifyRuntimeImageOverride(
      runtimeRow(product, product.activeImageAsset),
      resolveRuntimeRoot()
    );

    const files = {};
    const sourceRoot = resolveRuntimeRoot();
    for (const [role, field] of Object.entries(keys)) {
      const key = product.activeImageAsset[field];
      const bytes = readFileSync(resolve(sourceRoot, key));
      files[role] = {
        role,
        fileName: role === "original" ? "original" + extname(key) : role + ".webp",
        sha256: fileDigest(bytes, "sha256"),
        gitBlobOid: gitBlobId(bytes),
        sizeBytes: bytes.length
      };
    }

    const manifest = {
      formatVersion: 1,
      status: "DRAFT_REVIEW_REQUIRED",
      source: "OWNER_APPROVED_RUNTIME",
      repository: "Solyuuki/YsabelleStore",
      productId: product.id,
      sku: product.sku,
      candidateId: product.activeImageAssetId,
      canonicalRelease: state.releaseId,
      proposedAt: new Date().toISOString(),
      files,
      nextAction:
        "Review image rights and quality, then publish the complete versioned canonical release bundle; do not commit this draft as a release."
    };

    mkdirSync(args.output, { recursive: true });
    for (const [role, field] of Object.entries(keys)) {
      const key = product.activeImageAsset[field];
      copyFileSync(resolve(sourceRoot, key), join(args.output, files[role].fileName));
    }
    writeFileSync(
      join(args.output, "image-publication-proposal.json"),
      JSON.stringify(manifest, null, 2) + "\n"
    );
    console.log("CATALOG_IMAGE_PUBLICATION_PROPOSAL=READY_REVIEW_REQUIRED");
    console.log("EXPORTED_TO=" + args.output);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("CATALOG_IMAGE_PUBLICATION_PROPOSAL=ERROR " + error.message);
    process.exitCode = 1;
  });
}
