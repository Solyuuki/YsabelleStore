import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { searchPosProducts } from "../services/posService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { posProductSearchQuerySchema } from "../validators/pos.validators.js";

export const listProductsForPos: RequestHandler = async (request, response, next) => {
  try {
    const currentUser = getAuthenticatedUser(request);

    if (!currentUser) {
      throw new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      });
    }

    const parsedQuery = posProductSearchQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      throw new HttpError(400, "Product search query is invalid.", {
        code: "INVALID_PRODUCT_SEARCH_QUERY",
        details: parsedQuery.error.flatten()
      });
    }

    const data = await searchPosProducts(parsedQuery.data.q ?? "", {
      page: parsedQuery.data.page ?? 1,
      pageSize: parsedQuery.data.pageSize ?? 20
    });

    response.status(200).json(createSuccessResponse("Product search completed.", data));
  } catch (error) {
    next(error);
  }
};
