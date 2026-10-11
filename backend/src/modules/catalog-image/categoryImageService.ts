import { randomUUID } from "node:crypto";

import { catalogImageStorageFallbackRoots, catalogImageStorageRoot } from "../../config/env.js";
import { prisma } from "../../database/prismaClient.js";
import { HttpError } from "../../utils/httpError.js";
import { runCategoryCoverImageEngine } from "./catalogImageEngineRunner.js";
import { CatalogImageStorage } from "./catalogImageStorage.js";
import { inspectCategoryCoverUpload } from "./imageUploadPolicy.js";

type CategoryCoverUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type OwnerCategoryImageVariant = "original" | "processed" | "cover" | "thumbnail";
export type PublicCategoryImageVariant = "cover" | "thumbnail";

const storage = new CatalogImageStorage(catalogImageStorageRoot, catalogImageStorageFallbackRoots);

export function approvedCategoryCoverUrl(
  imageId: string,
  variant: PublicCategoryImageVariant = "cover"
) {
  return `/api/storefront/category-images/${encodeURIComponent(imageId)}/${variant}`;
}

export async function createCategoryImageCandidate(
  categoryId: string,
  file: CategoryCoverUploadFile
) {
  const category = await prisma.category.findUnique({
    select: { activeCoverAssetId: true, id: true },
    where: { id: categoryId }
  });

  if (!category) {
    throw new HttpError(404, "Category was not found.", { code: "CATEGORY_NOT_FOUND" });
  }

  const inspection = inspectCategoryCoverUpload(file);
  const candidateId = randomUUID();
  const originalStorageKey = await storage.writeCategoryOriginal(
    candidateId,
    inspection.extension,
    file.buffer
  );

  try {
    await prisma.$transaction([
      prisma.categoryImageAsset.create({
        data: {
          id: candidateId,
          categoryId,
          originalStorageKey,
          sourceBytes: file.size,
          sourceMimeType: inspection.detectedMimeType
        }
      }),
      prisma.category.updateMany({
        data: { coverStatus: "PROCESSING" },
        where: {
          activeCoverAssetId: null,
          id: categoryId
        }
      })
    ]);
  } catch (error) {
    await storage.removeCategoryCandidate(candidateId).catch(() => undefined);
    throw error;
  }

  return processCategoryImageCandidate(candidateId);
}

export async function getLatestCategoryImageCandidate(categoryId: string) {
  const category = await prisma.category.findUnique({
    select: { id: true },
    where: { id: categoryId }
  });
  if (!category) {
    throw new HttpError(404, "Category was not found.", { code: "CATEGORY_NOT_FOUND" });
  }

  return prisma.categoryImageAsset.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: {
      categoryId,
      qualityStatus: { not: "REJECTED" },
      rejectedAt: null
    }
  });
}

export async function processCategoryImageCandidate(candidateId: string) {
  const candidate = await prisma.categoryImageAsset.findUnique({
    where: { id: candidateId }
  });

  if (!candidate) {
    throw new HttpError(404, "Category cover candidate was not found.", {
      code: "CATEGORY_COVER_NOT_FOUND"
    });
  }

  if (candidate.processingStatus !== "PENDING") {
    return candidate;
  }

  const claimed = await prisma.categoryImageAsset.updateMany({
    data: { processingStatus: "PROCESSING" },
    where: { id: candidateId, processingStatus: "PENDING" }
  });
  if (claimed.count !== 1) {
    return prisma.categoryImageAsset.findUniqueOrThrow({ where: { id: candidateId } });
  }

  await prisma.category.updateMany({
    data: { coverStatus: "PROCESSING" },
    where: {
      activeCoverAssetId: null,
      id: candidate.categoryId
    }
  });

  try {
    const sourcePath = storage.resolveStorageKey(candidate.originalStorageKey);
    const outputDirectory = await storage.prepareCategoryCandidateOutputDirectory(candidateId);
    const result = await runCategoryCoverImageEngine(sourcePath, outputDirectory);

    const updated = await prisma.categoryImageAsset.update({
      data: {
        coverStorageKey: result.variants
          ? storage.categoryVariantStorageKey(candidateId, "cover")
          : null,
        diagnostics: result.diagnostics,
        processedStorageKey: result.variants
          ? storage.categoryVariantStorageKey(candidateId, "processed")
          : null,
        processingStatus: "READY",
        qualityStatus: result.status,
        sourceHeight: result.source.height,
        sourceWidth: result.source.width,
        thumbnailStorageKey: result.variants
          ? storage.categoryVariantStorageKey(candidateId, "thumbnail")
          : null
      },
      where: { id: candidateId }
    });

    await prisma.category.updateMany({
      data: {
        coverStatus: result.status === "REJECTED" ? "FAILED" : "NEEDS_REVIEW"
      },
      where: {
        activeCoverAssetId: null,
        id: candidate.categoryId
      }
    });

    return updated;
  } catch (error) {
    console.error("[category-cover] Candidate processing failed:", error);

    const updated = await prisma.categoryImageAsset.update({
      data: {
        coverStorageKey: null,
        diagnostics: [
          {
            code: "PROCESSING_FAILED",
            message: "Category cover processing could not be completed. Upload another image.",
            severity: "error"
          }
        ],
        processedStorageKey: null,
        processingStatus: "FAILED",
        qualityStatus: "NEEDS_REVIEW",
        thumbnailStorageKey: null
      },
      where: { id: candidateId }
    });

    await prisma.category.updateMany({
      data: { coverStatus: "FAILED" },
      where: {
        activeCoverAssetId: null,
        id: candidate.categoryId
      }
    });

    return updated;
  }
}

export async function approveCategoryImageCandidate(categoryId: string, imageId: string) {
  const approvedAt = new Date();

  return prisma.$transaction(async (transaction) => {
    const [category, candidate] = await Promise.all([
      transaction.category.findUnique({
        select: { activeCoverAssetId: true, id: true },
        where: { id: categoryId }
      }),
      transaction.categoryImageAsset.findUnique({ where: { id: imageId } })
    ]);

    if (!category) {
      throw new HttpError(404, "Category was not found.", { code: "CATEGORY_NOT_FOUND" });
    }
    if (!candidate || candidate.categoryId !== categoryId) {
      throw new HttpError(404, "Category cover candidate was not found.", {
        code: "CATEGORY_COVER_NOT_FOUND"
      });
    }
    if (
      candidate.processingStatus !== "READY" ||
      candidate.qualityStatus === "REJECTED" ||
      !candidate.processedStorageKey ||
      !candidate.coverStorageKey ||
      !candidate.thumbnailStorageKey
    ) {
      throw new HttpError(409, "Category cover is not ready for storefront approval.", {
        code: "CATEGORY_COVER_NOT_APPROVABLE"
      });
    }

    if (category.activeCoverAssetId && category.activeCoverAssetId !== candidate.id) {
      await transaction.categoryImageAsset.update({
        data: { supersededAt: approvedAt },
        where: { id: category.activeCoverAssetId }
      });
    }

    const approved = await transaction.categoryImageAsset.update({
      data: {
        approvedAt,
        qualityStatus: "APPROVED",
        rejectedAt: null,
        supersededAt: null
      },
      where: { id: candidate.id }
    });

    await transaction.category.update({
      data: {
        activeCoverAssetId: candidate.id,
        coverStatus: "READY"
      },
      where: { id: categoryId }
    });

    return approved;
  });
}

export async function rejectCategoryImageCandidate(categoryId: string, imageId: string) {
  return prisma.$transaction(async (transaction) => {
    const [category, candidate] = await Promise.all([
      transaction.category.findUnique({
        select: { activeCoverAssetId: true, id: true },
        where: { id: categoryId }
      }),
      transaction.categoryImageAsset.findUnique({ where: { id: imageId } })
    ]);

    if (!category) {
      throw new HttpError(404, "Category was not found.", { code: "CATEGORY_NOT_FOUND" });
    }
    if (!candidate || candidate.categoryId !== categoryId) {
      throw new HttpError(404, "Category cover candidate was not found.", {
        code: "CATEGORY_COVER_NOT_FOUND"
      });
    }
    if (category.activeCoverAssetId === candidate.id) {
      throw new HttpError(409, "The active category cover cannot be rejected in place.", {
        code: "CATEGORY_COVER_ACTIVE_CANNOT_REJECT"
      });
    }

    const rejected = await transaction.categoryImageAsset.update({
      data: {
        qualityStatus: "REJECTED",
        rejectedAt: new Date()
      },
      where: { id: candidate.id }
    });

    await transaction.category.update({
      data: { coverStatus: category.activeCoverAssetId ? "READY" : "MISSING" },
      where: { id: categoryId }
    });

    return rejected;
  });
}

export async function removeActiveCategoryCover(categoryId: string) {
  return prisma.$transaction(async (transaction) => {
    const category = await transaction.category.findUnique({
      select: { activeCoverAssetId: true, id: true },
      where: { id: categoryId }
    });
    if (!category) {
      throw new HttpError(404, "Category was not found.", { code: "CATEGORY_NOT_FOUND" });
    }

    if (category.activeCoverAssetId) {
      await transaction.categoryImageAsset.update({
        data: { supersededAt: new Date() },
        where: { id: category.activeCoverAssetId }
      });
    }

    return transaction.category.update({
      data: {
        activeCoverAssetId: null,
        coverStatus: "MISSING"
      },
      where: { id: categoryId }
    });
  });
}

export async function getOwnerCategoryImageVariant(
  categoryId: string,
  imageId: string,
  variant: OwnerCategoryImageVariant
) {
  const candidate = await prisma.categoryImageAsset.findUnique({ where: { id: imageId } });
  if (!candidate || candidate.categoryId !== categoryId) {
    throw new HttpError(404, "Category cover candidate was not found.", {
      code: "CATEGORY_COVER_NOT_FOUND"
    });
  }

  const key =
    variant === "original"
      ? candidate.originalStorageKey
      : variant === "processed"
        ? candidate.processedStorageKey
        : variant === "cover"
          ? candidate.coverStorageKey
          : candidate.thumbnailStorageKey;

  if (!key) {
    throw new HttpError(404, "Requested category cover variant is not available.", {
      code: "CATEGORY_COVER_VARIANT_NOT_FOUND"
    });
  }

  return {
    buffer: await storage.readStorageKey(key),
    mimeType: variant === "original" ? candidate.sourceMimeType : "image/webp"
  };
}

export async function getPublicCategoryImageVariant(
  imageId: string,
  variant: PublicCategoryImageVariant
) {
  const candidate = await prisma.categoryImageAsset.findUnique({
    select: {
      activeForCategory: { select: { id: true } },
      coverStorageKey: true,
      thumbnailStorageKey: true,
      processingStatus: true,
      qualityStatus: true
    },
    where: { id: imageId }
  });

  if (
    !candidate ||
    !candidate.activeForCategory ||
    candidate.processingStatus !== "READY" ||
    candidate.qualityStatus !== "APPROVED"
  ) {
    throw new HttpError(404, "Approved category cover was not found.", {
      code: "CATEGORY_COVER_NOT_FOUND"
    });
  }

  const key = variant === "cover" ? candidate.coverStorageKey : candidate.thumbnailStorageKey;
  if (!key) {
    throw new HttpError(404, "Approved category cover variant was not found.", {
      code: "CATEGORY_COVER_VARIANT_NOT_FOUND"
    });
  }

  return {
    buffer: await storage.readStorageKey(key),
    mimeType: "image/webp"
  };
}
