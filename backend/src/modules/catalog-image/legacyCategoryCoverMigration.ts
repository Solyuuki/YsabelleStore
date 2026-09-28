import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../../database/prismaClient.js";
import { PRODUCT_IMAGE_UPLOAD_LIMITS } from "../../security/security.constants.js";
import {
  approveCategoryImageCandidate,
  createCategoryImageCandidate
} from "./categoryImageService.js";
import {
  LEGACY_CATEGORY_COVER_SOURCES,
  type LegacyCategoryCoverSource
} from "./legacyCategoryCoverSources.js";

const LOCAL_CATEGORY_IMAGE_PATTERN =
  /^\/images\/discover\/essentials\/([A-Za-z0-9][A-Za-z0-9._-]*\.webp)$/;
const TRUSTED_REMOTE_HOST = "res.cloudinary.com";
const TRUSTED_REMOTE_PATH_PREFIX = "/gnqoa3sp/image/upload/";
const REMOTE_FETCH_TIMEOUT_MS = 15_000;

export type LegacyCategoryCoverMigrationReason =
  | "LOCAL_SOURCE_FOUND"
  | "TRUSTED_REMOTE_SOURCE"
  | "CATEGORY_NOT_FOUND"
  | "ACTIVE_COVER_EXISTS"
  | "COVER_HISTORY_EXISTS"
  | "LOCAL_SOURCE_NOT_FOUND";

export type LegacyCategoryCoverMigrationPlanItem = {
  categoryId: string | null;
  categoryName: string;
  slug: string;
  imageUrl: string;
  status: "ELIGIBLE" | "SKIPPED";
  reason: LegacyCategoryCoverMigrationReason;
  sourcePath?: string;
};

export type LegacyCategoryCoverMigrationResult = {
  plan: LegacyCategoryCoverMigrationPlanItem[];
  eligible: number;
  processed: number;
  approved: number;
  rejected: number;
  failed: number;
  skipped: number;
};

export function resolveLegacyLocalCategoryCoverSource(
  repositoryRoot: string,
  imageUrl: string
) {
  const match = LOCAL_CATEGORY_IMAGE_PATTERN.exec(imageUrl);
  const basename = match?.[1];

  if (!basename) return null;

  return path.join(
    repositoryRoot,
    "frontend",
    "public",
    "images",
    "discover",
    "essentials",
    basename
  );
}

export function isTrustedLegacyRemoteCategoryCover(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    return (
      url.protocol === "https:" &&
      url.hostname === TRUSTED_REMOTE_HOST &&
      url.pathname.startsWith(TRUSTED_REMOTE_PATH_PREFIX) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export async function planLegacyCategoryCoverMigration(
  options: { categoryId?: string; repositoryRoot?: string } = {}
): Promise<LegacyCategoryCoverMigrationPlanItem[]> {
  const repositoryRoot = options.repositoryRoot ?? path.resolve(".");
  const sources = LEGACY_CATEGORY_COVER_SOURCES;

  const categories = await prisma.category.findMany({
    select: {
      _count: { select: { coverAssets: true } },
      activeCoverAssetId: true,
      id: true,
      name: true,
      slug: true
    },
    where: options.categoryId
      ? { id: options.categoryId }
      : { slug: { in: sources.map((source) => source.slug) } }
  });
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  const requestedCategory =
    options.categoryId === undefined
      ? null
      : categories.find((category) => category.id === options.categoryId) ?? null;

  const relevantSources =
    options.categoryId === undefined
      ? [...sources]
      : requestedCategory
        ? sources.filter((source) => source.slug === requestedCategory.slug)
        : [];

  if (options.categoryId && !requestedCategory) {
    return [];
  }

  const plan: LegacyCategoryCoverMigrationPlanItem[] = [];

  for (const source of relevantSources) {
    const category = categoryBySlug.get(source.slug);
    const base = {
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? source.category,
      slug: source.slug,
      imageUrl: source.imageUrl
    };

    if (!category) {
      plan.push({ ...base, status: "SKIPPED", reason: "CATEGORY_NOT_FOUND" });
      continue;
    }
    if (category.activeCoverAssetId) {
      plan.push({ ...base, status: "SKIPPED", reason: "ACTIVE_COVER_EXISTS" });
      continue;
    }
    if (category._count.coverAssets > 0) {
      plan.push({ ...base, status: "SKIPPED", reason: "COVER_HISTORY_EXISTS" });
      continue;
    }

    const sourcePath = resolveLegacyLocalCategoryCoverSource(repositoryRoot, source.imageUrl);
    if (sourcePath) {
      try {
        await access(sourcePath);
        plan.push({
          ...base,
          status: "ELIGIBLE",
          reason: "LOCAL_SOURCE_FOUND",
          sourcePath
        });
      } catch {
        plan.push({ ...base, status: "SKIPPED", reason: "LOCAL_SOURCE_NOT_FOUND" });
      }
      continue;
    }

    if (isTrustedLegacyRemoteCategoryCover(source.imageUrl)) {
      plan.push({ ...base, status: "ELIGIBLE", reason: "TRUSTED_REMOTE_SOURCE" });
      continue;
    }

    plan.push({ ...base, status: "SKIPPED", reason: "LOCAL_SOURCE_NOT_FOUND" });
  }

  return plan;
}

async function readTrustedRemoteCover(source: LegacyCategoryCoverSource) {
  if (!isTrustedLegacyRemoteCategoryCover(source.imageUrl)) {
    throw new Error("Legacy category cover remote source is not allowlisted.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(source.imageUrl, {
      redirect: "error",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Legacy category cover fetch failed with status ${response.status}.`);
    }

    const declaredBytes = Number(response.headers.get("content-length") ?? "0");
    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > PRODUCT_IMAGE_UPLOAD_LIMITS.maxFileBytes
    ) {
      throw new Error("Legacy category cover exceeds the upload size limit.");
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > PRODUCT_IMAGE_UPLOAD_LIMITS.maxFileBytes) {
      throw new Error("Legacy category cover exceeds the upload size limit.");
    }

    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadPlanItemBuffer(
  item: LegacyCategoryCoverMigrationPlanItem,
  source: LegacyCategoryCoverSource
) {
  if (item.sourcePath) {
    return readFile(item.sourcePath);
  }
  return readTrustedRemoteCover(source);
}

export async function runLegacyCategoryCoverMigration(options: {
  apply: boolean;
  categoryId?: string;
  repositoryRoot?: string;
}): Promise<LegacyCategoryCoverMigrationResult> {
  const plan = await planLegacyCategoryCoverMigration(options);
  const result: LegacyCategoryCoverMigrationResult = {
    plan,
    eligible: plan.filter((item) => item.status === "ELIGIBLE").length,
    processed: 0,
    approved: 0,
    rejected: 0,
    failed: 0,
    skipped: plan.filter((item) => item.status === "SKIPPED").length
  };

  if (!options.apply) return result;

  for (const item of plan) {
    if (item.status !== "ELIGIBLE" || !item.categoryId) continue;

    const current = await prisma.category.findUnique({
      select: {
        _count: { select: { coverAssets: true } },
        activeCoverAssetId: true
      },
      where: { id: item.categoryId }
    });

    if (!current || current.activeCoverAssetId || current._count.coverAssets > 0) {
      result.skipped += 1;
      continue;
    }

    const source = LEGACY_CATEGORY_COVER_SOURCES.find((entry) => entry.slug === item.slug);
    if (!source) {
      result.failed += 1;
      continue;
    }

    try {
      const buffer = await loadPlanItemBuffer(item, source);
      const fileName = path.basename(new URL(source.imageUrl, "https://legacy.local").pathname);
      const candidate = await createCategoryImageCandidate(item.categoryId, {
        buffer,
        mimetype: "application/octet-stream",
        originalname: fileName,
        size: buffer.length
      });

      result.processed += 1;

      if (
        candidate.processingStatus !== "READY" ||
        candidate.qualityStatus === "REJECTED"
      ) {
        if (candidate.qualityStatus === "REJECTED") result.rejected += 1;
        else result.failed += 1;
        continue;
      }

      await approveCategoryImageCandidate(item.categoryId, candidate.id);
      result.approved += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

export async function verifyLegacyCategoryCoverMigration() {
  const categories = await prisma.category.findMany({
    select: {
      activeCoverAssetId: true,
      coverStatus: true,
      id: true,
      name: true,
      slug: true
    },
    where: {
      slug: { in: LEGACY_CATEGORY_COVER_SOURCES.map((source) => source.slug) }
    }
  });

  return LEGACY_CATEGORY_COVER_SOURCES.map((source) => {
    const category = categories.find((candidate) => candidate.slug === source.slug) ?? null;
    const ready = Boolean(
      category?.activeCoverAssetId && category.coverStatus === "READY"
    );

    return {
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? source.category,
      slug: source.slug,
      ready,
      reason: category ? (ready ? "READY" : "COVER_NOT_READY") : "CATEGORY_NOT_FOUND"
    } as const;
  });
}
