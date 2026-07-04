import type { Request, RequestHandler } from "express";

import { getUserFromToken, type SafeUser } from "../services/authService.js";
import { HttpError } from "../utils/httpError.js";

type RequestWithAuth = Request & {
  authUser?: SafeUser;
};

export function getAuthenticatedUser(request: Request): SafeUser | undefined {
  return (request as RequestWithAuth).authUser;
}

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    const authorization = request.get("authorization");
    const [scheme, token] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      throw new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      });
    }

    (request as RequestWithAuth).authUser = await getUserFromToken(token);
    next();
  } catch (error) {
    next(error);
  }
};
