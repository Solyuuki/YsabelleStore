import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { completeBulkDeliverySession } from "../services/bulkDeliveryService.js";
import { previewPdfDeliveryImport } from "../services/pdfDeliveryImportService.js";
import { HttpError } from "../utils/httpError.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import { completeBulkDeliverySchema } from "../validators/bulkDelivery.validators.js";

export const completeBulkDeliveryController: RequestHandler = async (request, response, next) => {
  try {
    const body = parseOrThrow(completeBulkDeliverySchema, request.body, {
      message: "Bulk delivery session is invalid.",
      code: "INVALID_BULK_DELIVERY_SESSION"
    });
    const actor = getAuthenticatedUser(request);
    const result = await completeBulkDeliverySession(body, actor?.id);

    response
      .status(201)
      .json(createSuccessResponse("Bulk delivery receipt completed successfully.", result));
  } catch (error) {
    next(error);
  }
};

type RequestWithFile = Parameters<RequestHandler>[0] & {
  file?: Express.Multer.File;
};

export const previewBulkDeliveryPdfController: RequestHandler = async (request, response, next) => {
  try {
    const uploaded = (request as RequestWithFile).file;
    if (!uploaded) {
      throw new HttpError(400, "A PDF delivery document is required.", {
        code: "DELIVERY_PDF_REQUIRED"
      });
    }
    const result = await previewPdfDeliveryImport({
      originalname: uploaded.originalname,
      mimetype: uploaded.mimetype,
      buffer: uploaded.buffer
    });
    response
      .status(200)
      .json(createSuccessResponse("PDF delivery preview generated successfully.", result));
  } catch (error) {
    next(error);
  }
};
