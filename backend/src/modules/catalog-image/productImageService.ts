import { randomUUID } from "node:crypto";

import { catalogImageStorageRoot } from "../../config/env.js";
import { prisma } from "../../database/prismaClient.js";
import { HttpError } from "../../utils/httpError.js";
import { CatalogImageStorage } from "./catalogImageStorage.js";
import { inspectProductImageUpload } from "./imageUploadPolicy.js";

type ProductImageUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const storage = new CatalogImageStorage(catalogImageStorageRoot);

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
    return await prisma.productImageAsset.create({
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
}
