#!/usr/bin/env node
// The default mode is READ ONLY. --apply needs the reviewed candidate ID,
// an exact canonical active ID, and explicit confirmation of independent backups.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

import {
  isRuntimeImageAssetId,
  validateRuntimeImageFiles
} from "./canonical-runtime-image-overrides.mjs";
import { resolveRuntimeRoot } from "./canonical-asset-materializer.mjs";

export function parseCatalogImageRecoveryArgs(argv) {
  const permitted = new Set([
    "--sku", "--product-id", "--image-id", "--expected-active-id",
    "--apply", "--backup-confirmed"
  ]);
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!permitted.has(argument) || Object.hasOwn(values, argument)) {
      throw new Error("Unknown or duplicate image recovery flag: " + argument);
    }
    if (argument === "--apply" || argument === "--backup-confirmed") {
      values[argument] = true;
    } else {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("Missing value for " + argument);
      }
      values[argument] = next;
      index += 1;
    }
  }
  if (Boolean(values["--sku"]) === Boolean(values["--product-id"])) {
    throw new Error("Specify exactly one of --sku and --product-id.");
  }
  if (!isRuntimeImageAssetId(values["--image-id"])) {
    throw new Error("--image-id must be a valid Owner-uploaded image UUID.");
  }
  if (!values["--expected-active-id"]) {
    throw new Error("--expected-active-id is required for safe compare-and-swap.");
  }
  if (values["--apply"] && !values["--backup-confirmed"]) {
    throw new Error("Backup MySQL and image storage before using --apply --backup-confirmed.");
  }
  return {
    sku: values["--sku"] ?? null,
    productId: values["--product-id"] ?? null,
    imageId: values["--image-id"],
    expectedActiveId: values["--expected-active-id"],
    apply: Boolean(values["--apply"])
  };
}

export function inspectCatalogImageRecovery({ product, candidate, newestApproved, expectedActiveId, imageId, canonicalId }) {
  if (!product || !candidate || !newestApproved) {
    throw new Error("Product or approved image candidate was not found.");
  }
  if (product.activeImageAssetId !== expectedActiveId) {
    throw new Error("Active product image changed; aborting stale recovery.");
  }
  if (canonicalId !== expectedActiveId) {
    throw new Error("The expected active image is not the reviewed canonical image; refusing overwrite.");
  }
  if (candidate.id !== imageId || candidate.productId !== product.id) {
    throw new Error("Candidate does not belong to the selected product.");
  }
  if (newestApproved.id !== imageId) {
    throw new Error("Selected image is not the latest approved candidate; manual review required.");
  }
  if (
    candidate.processingStatus !== "READY" ||
    candidate.qualityStatus !== "APPROVED" ||
    !candidate.approvedAt ||
    candidate.rejectedAt ||
    candidate.supersededAt
  ) {
    throw new Error("Candidate is not active-eligible (approved, READY, and not superseded).");
  }
  const prefix = "candidates/" + imageId + "/";
  if (
    !candidate.originalStorageKey?.startsWith(prefix) ||
    candidate.processedStorageKey !== prefix + "processed/processed.webp" ||
    candidate.cardStorageKey !== prefix + "processed/card.webp" ||
    candidate.pdpStorageKey !== prefix + "processed/pdp.webp"
  ) {
    throw new Error("Candidate media paths do not belong to the selected image.");
  }
  validateRuntimeImageFiles(
    {
      id: candidate.id,
      original_storage_key: candidate.originalStorageKey,
      processed_storage_key: candidate.processedStorageKey,
      card_storage_key: candidate.cardStorageKey,
      pdp_storage_key: candidate.pdpStorageKey
    },
    resolveRuntimeRoot()
  );
  return {
    productId: product.id,
    sku: product.sku,
    expectedActiveId,
    restoredImageId: imageId,
    imageUrl: "/api/storefront/product-images/" + imageId + "/card",
    detailImageUrl: "/api/storefront/product-images/" + imageId + "/pdp"
  };
}

async function main() {
  const args = parseCatalogImageRecoveryArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const state = JSON.parse(readFileSync(join("database", "prisma", "state", "canonical-state.json"), "utf8"));
    const release = JSON.parse(readFileSync(state.canonicalReleasePath, "utf8"));
    const product = await prisma.product.findUnique({
      where: args.sku ? { sku: args.sku } : { id: args.productId }
    });
    if (!product) throw new Error("Product not found.");
    const canonicalId = release.products.find((item) => item.productId === product.id)
      ?.catalogImage?.activeImageAssetId ?? null;
    const [candidate, newestApproved] = await Promise.all([
      prisma.productImageAsset.findUnique({ where: { id: args.imageId } }),
      prisma.productImageAsset.findFirst({
        where: {
          productId: product.id,
          qualityStatus: "APPROVED",
          processingStatus: "READY",
          rejectedAt: null,
          approvedAt: { not: null }
        },
        orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }]
      })
    ]);
    const plan = inspectCatalogImageRecovery({
      product,
      candidate,
      newestApproved,
      expectedActiveId: args.expectedActiveId,
      imageId: args.imageId,
      canonicalId
    });
    if (!args.apply) {
      console.log(JSON.stringify({ status: "READY_FOR_REVIEW_NO_CHANGES", plan }, null, 2));
      return;
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUniqueOrThrow({
        where: { id: plan.productId }
      });
      const activeCandidate = await tx.productImageAsset.findUniqueOrThrow({
        where: { id: plan.restoredImageId }
      });
      // Validate the same asset again before any database mutation.
      inspectCatalogImageRecovery({
        product: current,
        candidate: activeCandidate,
        newestApproved,
        expectedActiveId: plan.expectedActiveId,
        imageId: plan.restoredImageId,
        canonicalId
      });
      const changed = await tx.product.updateMany({
        where: { id: plan.productId, activeImageAssetId: plan.expectedActiveId },
        data: { activeImageAssetId: plan.restoredImageId, imageUrl: plan.imageUrl }
      });
      if (changed.count !== 1) {
        throw new Error("Concurrent image change detected; nothing restored.");
      }
      await tx.catalogAuditLog.create({
        data: {
          action: "APPROVED_PRODUCT_IMAGE_RECOVERED",
          automated: false,
          actor: "operator-approved-recovery",
          canonicalProductId: plan.productId,
          entityType: "PRODUCT",
          entityId: plan.productId,
          reason: "Restore verified Owner-approved image after canonical sync rollback.",
          evidence: {
            fromImageId: plan.expectedActiveId,
            toImageId: plan.restoredImageId,
            sku: plan.sku
          }
        }
      });
    });
    console.log(JSON.stringify({ status: "RESTORED", plan }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("CATALOG_IMAGE_RECOVERY=BLOCKED: " + error.message);
    process.exitCode = 1;
  });
}
