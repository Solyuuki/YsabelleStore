import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "./authMiddleware.js";
import { HttpError } from "../utils/httpError.js";
import type { SafeUser } from "../services/authService.js";

export function hasRole(
  user: SafeUser | undefined,
  allowedRoles: readonly SafeUser["role"][]
): boolean {
  return Boolean(user && allowedRoles.includes(user.role));
}

export function requireRole(...allowedRoles: SafeUser["role"][]): RequestHandler {
  return (request, _response, next) => {
    const user = getAuthenticatedUser(request);

    if (!user) {
      next(
        new HttpError(401, "Authentication token is required.", {
          code: "AUTH_TOKEN_REQUIRED"
        })
      );
      return;
    }

    if (!hasRole(user, allowedRoles)) {
      next(
        new HttpError(403, "You do not have permission to access this resource.", {
          code: "INSUFFICIENT_ROLE"
        })
      );
      return;
    }

    next();
  };
}
