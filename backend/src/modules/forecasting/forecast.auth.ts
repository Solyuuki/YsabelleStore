import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";

export const requireOwner: RequestHandler = (request, _response, next) => {
  const user = getAuthenticatedUser(request);

  if (!user) {
    next(
      new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      })
    );
    return;
  }

  if (user.role !== "OWNER") {
    next(
      new HttpError(403, "Only owner users can access forecasts.", {
        code: "OWNER_ACCESS_REQUIRED"
      })
    );
    return;
  }

  next();
};
