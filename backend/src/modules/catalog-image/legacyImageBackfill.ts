import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../../database/prismaClient.js";
import { createProductImageCandidate } from "./productImageService.js";

const LEGACY_PRODUCT_IMAGE_PATTERN = /^\/images\/products\/([^/?#\\]+)$/;

export type LegacyImageBackfillPlanItem = {
  productId: string;
  productName: string;
  imageUrl: string | null;
  status: "ELIGIBLE" | "SKIPPED";
  reason:
    | "RETAINED_SOURCE_FOUND"
    | "ACTIVE_IMAGE_EXISTS"
    | "IMAGE_ASSET_EXISTS"
    | "NO_LEGACY_IMAGE"
    | "UNSAFE_OR_UNSUPPORTED_LEGACY_URL"
    | "SOURCE_NOT_FOUND";
  sourcePath?: string;
};

export type LegacyImageBackfillResult = {
  plan: LegacyImageBackfillPlanItem[];
  eligible: number;
  processed: number;
  approvedQuality: number;
  needsReview: number;
  rejected: number;
  failed: number;
  skipped: number;
};

export function resolveLegacyProductImageSource(repositoryRoot: string, imageUrl: string | null) {
  if (!imageUrl) {
    return null;
  }

  const match = LEGACY_PRODUCT_IMAGE_PATTERN.exec(imageUrl);
  const basename = match?.[1];

  if (!basename || basename === "." || basename === "..") {
    return null;
  }

  return path.join(
    repositoryRoot,
    "frontend",
    "public",
    "images",
    "products",
    "originals",
    basename
  );
}

export async function planLegacyProductImageBackfill(
  options: { productId?: string; repositoryRoot?: string } = {}
): Promise<LegacyImageBackfillPlanItem[]> {
  const repositoryRoot = options.repositoryRoot ?? path.resolve(".");
  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    select: {
      _count: { select: { imageAssets: true } },
      activeImageAssetId: true,
      id: true,
      imageUrl: true,
      name: true
    },
    where: options.productId ? { id: options.productId } : undefined
  });

  const plan: LegacyImageBackfillPlanItem[] = [];

  for (const product of products) {
    const base = {
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl
    };

    if (product.activeImageAssetId) {
      plan.push({ ...base, status: "SKIPPED", reason: "ACTIVE_IMAGE_EXISTS" });
      continue;
    }

    if (product._count.imageAssets > 0) {
      plan.push({ ...base, status: "SKIPPED", reason: "IMAGE_ASSET_EXISTS" });
      continue;
    }

    if (!product.imageUrl) {
      plan.push({ ...base, status: "SKIPPED", reason: "NO_LEGACY_IMAGE" });
      continue;
    }

    const sourcePath = resolveLegacyProductImageSource(repositoryRoot, product.imageUrl);
    if (!sourcePath) {
      plan.push({
        ...base,
        status: "SKIPPED",
        reason: "UNSAFE_OR_UNSUPPORTED_LEGACY_URL"
      });
      continue;
    }

    try {
      await access(sourcePath);
    } catch {
      plan.push({ ...base, status: "SKIPPED", reason: "SOURCE_NOT_FOUND" });
      continue;
    }

    plan.push({
      ...base,
      status: "ELIGIBLE",
      reason: "RETAINED_SOURCE_FOUND",
      sourcePath
    });
  }

  return plan;
}

export async function runLegacyProductImageBackfill(options: {
  apply: boolean;
  productId?: string;
  repositoryRoot?: string;
}): Promise<LegacyImageBackfillResult> {
  const plan = await planLegacyProductImageBackfill({
    productId: options.productId,
    repositoryRoot: options.repositoryRoot
  });
  const result: LegacyImageBackfillResult = {
    plan,
    eligible: plan.filter((item) => item.status === "ELIGIBLE").length,
    processed: 0,
    approvedQuality: 0,
    needsReview: 0,
    rejected: 0,
    failed: 0,
    skipped: plan.filter((item) => item.status === "SKIPPED").length
  };

  if (!options.apply) {
    return result;
  }

  for (const item of plan) {
    if (item.status !== "ELIGIBLE" || !item.sourcePath) {
      continue;
    }

    const currentProduct = await prisma.product.findUnique({
      select: {
        _count: { select: { imageAssets: true } },
        activeImageAssetId: true
      },
      where: { id: item.productId }
    });

    if (
      !currentProduct ||
      currentProduct.activeImageAssetId ||
      currentProduct._count.imageAssets > 0
    ) {
      result.skipped += 1;
      continue;
    }

    try {
      const buffer = await readFile(item.sourcePath);
      const candidate = await createProductImageCandidate(item.productId, {
        buffer,
        mimetype: "application/octet-stream",
        originalname: path.basename(item.sourcePath),
        size: buffer.length
      });

      result.processed += 1;

      if (candidate.processingStatus === "FAILED") {
        result.failed += 1;
      } else if (candidate.qualityStatus === "APPROVED") {
        result.approvedQuality += 1;
      } else if (candidate.qualityStatus === "REJECTED") {
        result.rejected += 1;
      } else {
        result.needsReview += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
