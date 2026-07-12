import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { listRecentSales } from "../services/posService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { salesListQuerySchema } from "../validators/pos.validators.js";

export const listSales: RequestHandler = async (request, response, next) => {
  try {
    const currentUser = getAuthenticatedUser(request);

    if (!currentUser) {
      throw new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      });
    }

    const parsedQuery = salesListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      throw new HttpError(400, "Sales query is invalid.", {
        code: "INVALID_SALES_QUERY",
        details: parsedQuery.error.flatten()
      });
    }

    const data = await listRecentSales(parsedQuery.data.limit ?? 20);

    response.status(200).json(createSuccessResponse("Sales loaded successfully.", data));
  } catch (error) {
    next(error);
  }
};
