import type { RequestHandler } from "express";

import {
  approveCategoryImageCandidate,
  createCategoryImageCandidate,
  getLatestCategoryImageCandidate,
  getOwnerCategoryImageVariant,
  getPublicCategoryImageVariant,
  rejectCategoryImageCandidate,
  removeActiveCategoryCover,
  type OwnerCategoryImageVariant,
  type PublicCategoryImageVariant
} from "../modules/catalog-image/categoryImageService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";

const OWNER_VARIANTS = new Set<OwnerCategoryImageVariant>([
  "original",
  "processed",
  "cover",
  "thumbnail"
]);
const PUBLIC_VARIANTS = new Set<PublicCategoryImageVariant>(["cover", "thumbnail"]);

function requiredParam(value: string | undefined, code: string, message: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new HttpError(400, message, { code });
  }
  return normalized;
}

export const uploadCategoryImageController: RequestHandler = async (request, response, next) => {
  try {
    const categoryId = requiredParam(
      request.params.categoryId,
      "INVALID_CATEGORY_ID",
      "Category id is invalid."
    );
    if (!request.file) {
      throw new HttpError(400, "A category cover image file is required.", {
        code: "CATEGORY_COVER_REQUIRED"
      });
    }

    const candidate = await createCategoryImageCandidate(categoryId, request.file);
    response
      .status(201)
      .json(createSuccessResponse("Category cover candidate processed successfully.", candidate));
  } catch (error) {
    next(error);
  }
};

export const getLatestCategoryImageController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const categoryId = requiredParam(
      request.params.categoryId,
      "INVALID_CATEGORY_ID",
      "Category id is invalid."
    );
    const candidate = await getLatestCategoryImageCandidate(categoryId);
    response
      .status(200)
      .json(createSuccessResponse("Latest category cover candidate loaded.", { candidate }));
  } catch (error) {
    next(error);
  }
};

export const approveCategoryImageController: RequestHandler = async (request, response, next) => {
  try {
    const categoryId = requiredParam(
      request.params.categoryId,
      "INVALID_CATEGORY_ID",
      "Category id is invalid."
    );
    const imageId = requiredParam(
      request.params.imageId,
      "INVALID_CATEGORY_COVER_ID",
      "Category cover id is invalid."
    );
    const candidate = await approveCategoryImageCandidate(categoryId, imageId);
    response
      .status(200)
      .json(createSuccessResponse("Category cover approved successfully.", candidate));
  } catch (error) {
    next(error);
  }
};

export const rejectCategoryImageController: RequestHandler = async (request, response, next) => {
  try {
    const categoryId = requiredParam(
      request.params.categoryId,
      "INVALID_CATEGORY_ID",
      "Category id is invalid."
    );
    const imageId = requiredParam(
      request.params.imageId,
      "INVALID_CATEGORY_COVER_ID",
      "Category cover id is invalid."
    );
    const candidate = await rejectCategoryImageCandidate(categoryId, imageId);
    response
      .status(200)
      .json(createSuccessResponse("Category cover discarded successfully.", candidate));
  } catch (error) {
    next(error);
  }
};

export const removeActiveCategoryCoverController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const categoryId = requiredParam(
      request.params.categoryId,
      "INVALID_CATEGORY_ID",
      "Category id is invalid."
    );
    const category = await removeActiveCategoryCover(categoryId);
    response
      .status(200)
      .json(createSuccessResponse("Category cover removed successfully.", category));
  } catch (error) {
    next(error);
  }
};

export const previewCategoryImageController: RequestHandler = async (request, response, next) => {
  try {
    const categoryId = requiredParam(
      request.params.categoryId,
      "INVALID_CATEGORY_ID",
      "Category id is invalid."
    );
    const imageId = requiredParam(
      request.params.imageId,
      "INVALID_CATEGORY_COVER_ID",
      "Category cover id is invalid."
    );
    const variant = requiredParam(
      request.params.variant,
      "INVALID_CATEGORY_COVER_VARIANT",
      "Category cover variant is invalid."
    ) as OwnerCategoryImageVariant;

    if (!OWNER_VARIANTS.has(variant)) {
      throw new HttpError(400, "Category cover variant is invalid.", {
        code: "INVALID_CATEGORY_COVER_VARIANT"
      });
    }

    const asset = await getOwnerCategoryImageVariant(categoryId, imageId, variant);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Type", asset.mimeType);
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    response.status(200).send(asset.buffer);
  } catch (error) {
    next(error);
  }
};

export const publicCategoryImageController: RequestHandler = async (request, response, next) => {
  try {
    const imageId = requiredParam(
      request.params.imageId,
      "INVALID_CATEGORY_COVER_ID",
      "Category cover id is invalid."
    );
    const variant = requiredParam(
      request.params.variant,
      "INVALID_CATEGORY_COVER_VARIANT",
      "Category cover variant is invalid."
    ) as PublicCategoryImageVariant;

    if (!PUBLIC_VARIANTS.has(variant)) {
      throw new HttpError(404, "Approved category cover was not found.", {
        code: "CATEGORY_COVER_NOT_FOUND"
      });
    }

    const asset = await getPublicCategoryImageVariant(imageId, variant);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    response.setHeader("Content-Type", asset.mimeType);
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    response.status(200).send(asset.buffer);
  } catch (error) {
    next(error);
  }
};
