import type { RequestHandler } from "express";

import {
  approveProductImageCandidate,
  createProductImageCandidate,
  getOwnerProductImageVariant,
  getPublicProductImageVariant,
  rejectProductImageCandidate,
  type OwnerProductImageVariant,
  type PublicProductImageVariant
} from "../modules/catalog-image/productImageService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import { productIdParamSchema } from "../validators/product.validators.js";

const OWNER_VARIANTS = new Set<OwnerProductImageVariant>([
  "original",
  "processed",
  "card",
  "pdp"
]);
const PUBLIC_VARIANTS = new Set<PublicProductImageVariant>(["card", "pdp"]);

function requiredParam(value: string | undefined, code: string, message: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new HttpError(400, message, { code });
  }
  return normalized;
}

export const uploadProductImageController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(productIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });

    if (!request.file) {
      throw new HttpError(400, "A product image file is required.", {
        code: "PRODUCT_IMAGE_REQUIRED"
      });
    }

    const candidate = await createProductImageCandidate(params.id, request.file);

    response
      .status(201)
      .json(createSuccessResponse("Product image candidate processed successfully.", candidate));
  } catch (error) {
    next(error);
  }
};

export const approveProductImageController: RequestHandler = async (request, response, next) => {
  try {
    const productId = requiredParam(
      request.params.productId,
      "INVALID_PRODUCT_ID",
      "Product id is invalid."
    );
    const imageId = requiredParam(
      request.params.imageId,
      "INVALID_PRODUCT_IMAGE_ID",
      "Product image id is invalid."
    );
    const candidate = await approveProductImageCandidate(productId, imageId);

    response
      .status(200)
      .json(createSuccessResponse("Product image approved successfully.", candidate));
  } catch (error) {
    next(error);
  }
};

export const rejectProductImageController: RequestHandler = async (request, response, next) => {
  try {
    const productId = requiredParam(
      request.params.productId,
      "INVALID_PRODUCT_ID",
      "Product id is invalid."
    );
    const imageId = requiredParam(
      request.params.imageId,
      "INVALID_PRODUCT_IMAGE_ID",
      "Product image id is invalid."
    );
    const candidate = await rejectProductImageCandidate(productId, imageId);

    response
      .status(200)
      .json(createSuccessResponse("Product image rejected successfully.", candidate));
  } catch (error) {
    next(error);
  }
};

export const previewProductImageController: RequestHandler = async (request, response, next) => {
  try {
    const productId = requiredParam(
      request.params.productId,
      "INVALID_PRODUCT_ID",
      "Product id is invalid."
    );
    const imageId = requiredParam(
      request.params.imageId,
      "INVALID_PRODUCT_IMAGE_ID",
      "Product image id is invalid."
    );
    const variantValue = requiredParam(
      request.params.variant,
      "INVALID_PRODUCT_IMAGE_VARIANT",
      "Product image variant is invalid."
    ) as OwnerProductImageVariant;

    if (!OWNER_VARIANTS.has(variantValue)) {
      throw new HttpError(400, "Product image variant is invalid.", {
        code: "INVALID_PRODUCT_IMAGE_VARIANT"
      });
    }

    const asset = await getOwnerProductImageVariant(productId, imageId, variantValue);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Type", asset.mimeType);
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    response.status(200).send(asset.buffer);
  } catch (error) {
    next(error);
  }
};

export const publicProductImageController: RequestHandler = async (request, response, next) => {
  try {
    const imageId = requiredParam(
      request.params.imageId,
      "INVALID_PRODUCT_IMAGE_ID",
      "Product image id is invalid."
    );
    const variantValue = requiredParam(
      request.params.variant,
      "INVALID_PRODUCT_IMAGE_VARIANT",
      "Product image variant is invalid."
    ) as PublicProductImageVariant;

    if (!PUBLIC_VARIANTS.has(variantValue)) {
      throw new HttpError(404, "Approved product image was not found.", {
        code: "PRODUCT_IMAGE_NOT_FOUND"
      });
    }

    const asset = await getPublicProductImageVariant(imageId, variantValue);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    response.setHeader("Content-Type", asset.mimeType);
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    response.status(200).send(asset.buffer);
  } catch (error) {
    next(error);
  }
};
