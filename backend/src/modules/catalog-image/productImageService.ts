import { randomUUID } from "node:crypto";

import { catalogImageStorageRoot } from "../../config/env.js";
import { prisma } from "../../database/prismaClient.js";
import { HttpError } from "../../utils/httpError.js";
import { runCatalogImageEngine } from "./catalogImageEngineRunner.js";
import { CatalogImageStorage } from "./catalogImageStorage.js";
import { inspectProductImageUpload } from "./imageUploadPolicy.js";

type ProductImageUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const storage = new CatalogImageStorage(catalogImageStorageRoot);

export function approvedProductImageUrl(imageId: string, variant: "card" | "pdp") {
  return `/api/storefront/product-images/${encodeURIComponent(imageId)}/${variant}`;
}

export async function createProductImageCandidate(
  productId: string,
  file: ProductImageUploadFile
) {
  const product = await prisma.product.findUnique({
    select: { id: true },
    where: { id: productId }
  });

  if (!product) {
    throw new HttpError(404, "Product was not found.", {
      code: "PRODUCT_NOT_FOUND"
    });
  }

  const inspection = inspectProductImageUpload(file);
  const candidateId = randomUUID();
  const originalStorageKey = await storage.writeOriginal(
    candidateId,
    inspection.extension,
    file.buffer
  );

  try {
    await prisma.productImageAsset.create({
      data: {
        id: candidateId,
        originalStorageKey,
        productId,
        sourceBytes: file.size,
        sourceMimeType: inspection.detectedMimeType
      }
    });
  } catch (error) {
    await storage.removeCandidate(candidateId).catch(() => undefined);
    throw error;
  }

  return processProductImageCandidate(candidateId);
}

export async function processProductImageCandidate(candidateId: string) {
  const candidate = await prisma.productImageAsset.findUnique({
    where: { id: candidateId }
  });

  if (!candidate) {
    throw new HttpError(404, "Product image candidate was not found.", {
      code: "PRODUCT_IMAGE_NOT_FOUND"
    });
  }

  if (candidate.processingStatus !== "PENDING") {
    return candidate;
  }

  const claimed = await prisma.productImageAsset.updateMany({
    data: { processingStatus: "PROCESSING" },
    where: {
      id: candidateId,
      processingStatus: "PENDING"
    }
  });

  if (claimed.count !== 1) {
    return prisma.productImageAsset.findUniqueOrThrow({ where: { id: candidateId } });
  }

  try {
    const sourcePath = storage.resolveStorageKey(candidate.originalStorageKey);
    const outputDirectory = await storage.prepareCandidateOutputDirectory(candidateId);
    const result = await runCatalogImageEngine(sourcePath, outputDirectory);

    return await prisma.productImageAsset.update({
      data: {
        cardStorageKey: result.variants
          ? storage.variantStorageKey(candidateId, "card")
          : null,
        diagnostics: result.diagnostics,
        pdpStorageKey: result.variants
          ? storage.variantStorageKey(candidateId, "pdp")
          : null,
        processedStorageKey: result.variants
          ? storage.variantStorageKey(candidateId, "processed")
          : null,
        processingStatus: "READY",
        qualityStatus: result.status,
        sourceHeight: result.source.height,
        sourceWidth: result.source.width
      },
      where: { id: candidateId }
    });
  } catch (error) {
    console.error("[catalog-image] Candidate processing failed:", error);

    return await prisma.productImageAsset.update({
      data: {
        cardStorageKey: null,
        diagnostics: [
          {
            code: "PROCESSING_FAILED",
            message: "Image processing could not be completed. Upload another image or try again later.",
            severity: "error"
          }
        ],
        pdpStorageKey: null,
        processedStorageKey: null,
        processingStatus: "FAILED",
        qualityStatus: "NEEDS_REVIEW"
      },
      where: { id: candidateId }
    });
  }
}

export async function approveProductImageCandidate(productId: string, imageId: string) {
  const approvedAt = new Date();

  return prisma.$transaction(async (transaction) => {
    const [product, candidate] = await Promise.all([
      transaction.product.findUnique({
        select: { activeImageAssetId: true, id: true },
        where: { id: productId }
      }),
      transaction.productImageAsset.findUnique({ where: { id: imageId } })
    ]);

    if (!product) {
      throw new HttpError(404, "Product was not found.", {
        code: "PRODUCT_NOT_FOUND"
      });
    }
    if (!candidate || candidate.productId !== productId) {
      throw new HttpError(404, "Product image candidate was not found.", {
        code: "PRODUCT_IMAGE_NOT_FOUND"
      });
    }
    if (
      candidate.processingStatus !== "READY" ||
      candidate.qualityStatus !== "APPROVED" ||
      !candidate.processedStorageKey ||
      !candidate.cardStorageKey ||
      !candidate.pdpStorageKey
    ) {
      throw new HttpError(409, "Product image is not ready for storefront approval.", {
        code: "PRODUCT_IMAGE_NOT_APPROVABLE"
      });
    }

    if (product.activeImageAssetId && product.activeImageAssetId !== candidate.id) {
      await transaction.productImageAsset.update({
        data: { supersededAt: approvedAt },
        where: { id: product.activeImageAssetId }
      });
    }

    const approved = await transaction.productImageAsset.update({
      data: {
        approvedAt,
        rejectedAt: null,
        supersededAt: null
      },
      where: { id: candidate.id }
    });

    await transaction.product.update({
      data: {
        activeImageAssetId: candidate.id,
        imageUrl: approvedProductImageUrl(candidate.id, "card")
      },
      where: { id: productId }
    });

    return approved;
  });
}

export async function rejectProductImageCandidate(productId: string, imageId: string) {
  const [product, candidate] = await Promise.all([
    prisma.product.findUnique({
      select: { activeImageAssetId: true, id: true },
      where: { id: productId }
    }),
    prisma.productImageAsset.findUnique({ where: { id: imageId } })
  ]);

  if (!product) {
    throw new HttpError(404, "Product was not found.", { code: "PRODUCT_NOT_FOUND" });
  }
  if (!candidate || candidate.productId !== productId) {
    throw new HttpError(404, "Product image candidate was not found.", {
      code: "PRODUCT_IMAGE_NOT_FOUND"
    });
  }
  if (product.activeImageAssetId === candidate.id) {
    throw new HttpError(409, "The active storefront image cannot be rejected in place.", {
      code: "PRODUCT_IMAGE_ACTIVE_CANNOT_REJECT"
    });
  }

  return prisma.productImageAsset.update({
    data: {
      qualityStatus: "REJECTED",
      rejectedAt: new Date()
    },
    where: { id: candidate.id }
  });
}
