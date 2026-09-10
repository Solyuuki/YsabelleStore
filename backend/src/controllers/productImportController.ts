import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import {
  downloadGoogleDriveProductPackage,
  importProductPackage,
  previewProductPackage
} from "../services/productPackageImportService.js";
import { preparePackageImageIdentity } from "../services/productPackageImageIdentityService.js";

type RequestWithFile = Parameters<RequestHandler>[0] & {
  file?: Express.Multer.File;
};

function getUploadedPackage(request: RequestWithFile) {
  if (!request.file) {
    throw new HttpError(400, "A product package archive is required.", {
      code: "PRODUCT_PACKAGE_FILE_REQUIRED"
    });
  }

  return {
    originalname: request.file.originalname,
    mimetype: request.file.mimetype,
    buffer: request.file.buffer
  };
}

function getGoogleDriveLink(request: Parameters<RequestHandler>[0]) {
  const link = typeof request.body?.url === "string" ? request.body.url.trim() : "";
  if (!link) {
    throw new HttpError(400, "A Google Drive package link is required.", {
      code: "GOOGLE_DRIVE_LINK_REQUIRED"
    });
  }
  return link;
}

export const previewProductImportController: RequestHandler = async (request, response, next) => {
  try {
    const uploaded = getUploadedPackage(request as RequestWithFile);
    const file = await preparePackageImageIdentity(uploaded);
    const result = await previewProductPackage(file);

    response
      .status(200)
      .json(createSuccessResponse("Product package scan completed successfully.", result));
  } catch (error) {
    next(error);
  }
};

export const importProductsController: RequestHandler = async (request, response, next) => {
  try {
    const uploaded = getUploadedPackage(request as RequestWithFile);
    const file = await preparePackageImageIdentity(uploaded);
    const actor = getAuthenticatedUser(request);
    const result = await importProductPackage(file, actor?.id);

    response
      .status(201)
      .json(createSuccessResponse("Product package import completed successfully.", result));
  } catch (error) {
    next(error);
  }
};

export const previewGoogleDriveProductImportController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const downloaded = await downloadGoogleDriveProductPackage(getGoogleDriveLink(request));
    const file = await preparePackageImageIdentity(downloaded);
    const result = await previewProductPackage(file, "GOOGLE_DRIVE");
    response
      .status(200)
      .json(createSuccessResponse("Google Drive product package scan completed successfully.", result));
  } catch (error) {
    next(error);
  }
};

export const importGoogleDriveProductsController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const actor = getAuthenticatedUser(request);
    const downloaded = await downloadGoogleDriveProductPackage(getGoogleDriveLink(request));
    const file = await preparePackageImageIdentity(downloaded);
    const result = await importProductPackage(file, actor?.id, "GOOGLE_DRIVE");
    response
      .status(201)
      .json(createSuccessResponse("Google Drive product package import completed successfully.", result));
  } catch (error) {
    next(error);
  }
};
