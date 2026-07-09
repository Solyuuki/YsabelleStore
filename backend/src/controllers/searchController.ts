import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { searchSystem } from "../services/searchService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { searchQuerySchema } from "../validators/search.validators.js";

export const search: RequestHandler = async (request, response, next) => {
  try {
    const currentUser = getAuthenticatedUser(request);

    if (!currentUser) {
      throw new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      });
    }

    const parsedQuery = searchQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      throw new HttpError(400, "Search query is invalid.", {
        code: "INVALID_SEARCH_QUERY",
        details: parsedQuery.error.flatten()
      });
    }

    const data = await searchSystem(parsedQuery.data.q, currentUser.role);

    response.status(200).json(createSuccessResponse("Search results loaded.", data));
  } catch (error) {
    next(error);
  }
};
