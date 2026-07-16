import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { checkoutPosSale } from "../services/posService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { posCheckoutRequestSchema } from "../validators/pos.validators.js";

export const checkoutSale: RequestHandler = async (request, response, next) => {
  try {
    const currentUser = getAuthenticatedUser(request);

    if (!currentUser) {
      throw new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      });
    }

    const parsedBody = posCheckoutRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Checkout request is invalid.", {
        code: "INVALID_POS_CHECKOUT_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const data = await checkoutPosSale({
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      items: parsedBody.data.items,
      notes: parsedBody.data.notes
    });

    response.status(200).json(createSuccessResponse("Sale completed successfully.", data));
  } catch (error) {
    next(error);
  }
};
