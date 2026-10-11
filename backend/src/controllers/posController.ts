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

    const requestKey = request.header("Idempotency-Key");
    if (requestKey && !/^[a-zA-Z0-9-]{16,96}$/.test(requestKey)) {
      throw new HttpError(422, "POS checkout request key is invalid.", {
        code: "POS_IDEMPOTENCY_KEY_INVALID"
      });
    }

    const data = await checkoutPosSale({
      requestKey,
      cashReceived: parsedBody.data.cashReceived,
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      items: parsedBody.data.items,
      notes: parsedBody.data.notes
    });

    response.status(201).json(createSuccessResponse("Sale completed successfully.", data));
  } catch (error) {
    next(error);
  }
};
