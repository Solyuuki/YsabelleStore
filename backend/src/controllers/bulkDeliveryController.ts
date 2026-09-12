import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { completeBulkDeliverySession } from "../services/bulkDeliveryService.js";
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
