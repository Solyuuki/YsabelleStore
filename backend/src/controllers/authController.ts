import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { loginWithPassword, registerLocalUser } from "../services/authService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { loginRequestSchema, registerRequestSchema } from "../validators/auth.validators.js";

export const login: RequestHandler = async (request, response, next) => {
  try {
    const parsedBody = loginRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Login request is invalid.", {
        code: "INVALID_LOGIN_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const session = await loginWithPassword(parsedBody.data);

    response.status(200).json(createSuccessResponse("Login successful.", session));
  } catch (error) {
    next(error);
  }
};

export const register: RequestHandler = async (request, response, next) => {
  try {
    const parsedBody = registerRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Registration request is invalid.", {
        code: "INVALID_REGISTER_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const session = await registerLocalUser(parsedBody.data);

    response.status(201).json(createSuccessResponse("Registration successful.", session));
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser: RequestHandler = (request, response, next) => {
  const user = getAuthenticatedUser(request);

  if (!user) {
    next(
      new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      })
    );
    return;
  }

  response.status(200).json(createSuccessResponse("Current user loaded.", { user }));
};

export const logout: RequestHandler = (_request, response) => {
  response.status(200).json(createSuccessResponse("Logout successful."));
};
