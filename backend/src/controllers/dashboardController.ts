import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { getDashboardSummary } from "../services/dashboardService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";

export const getDashboardSummaryController: RequestHandler = async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request);

    if (!user) {
      throw new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      });
    }

    const summary = await getDashboardSummary(user.role);

    response
      .status(200)
      .json(createSuccessResponse("Dashboard summary loaded successfully.", summary));
  } catch (error) {
    next(error);
  }
};
