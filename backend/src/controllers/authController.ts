import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import {
  loginWithPassword,
  registerLocalUser,
  restoreTrustedDeviceSession,
  revokeTrustedDevice
} from "../services/authService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import {
  loginRequestSchema,
  registerRequestSchema,
  trustedDeviceRequestSchema
} from "../validators/auth.validators.js";

export const login: RequestHandler = async (request, response, next) => {
  try {
    const parsedBody = loginRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Login request is invalid.", {
        code: "INVALID_LOGIN_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const session = await loginWithPassword(parsedBody.data, {
      userAgent: request.get("user-agent")
    });

    response.status(200).json(createSuccessResponse("Login successful.", session));
  } catch (error) {
    next(error);
  }
};

export const register: RequestHandler = async (request, response, next) => {
  try {
    const currentUser = getAuthenticatedUser(request);

    if (!currentUser || currentUser.role !== "OWNER") {
      throw new HttpError(403, "Only owner users can create store accounts.", {
        code: "OWNER_ACCESS_REQUIRED"
      });
    }

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

export const createTrustedDeviceSession: RequestHandler = async (request, response, next) => {
  try {
    const parsedBody = trustedDeviceRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Trusted device request is invalid.", {
        code: "INVALID_TRUSTED_DEVICE_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const session = await restoreTrustedDeviceSession(parsedBody.data);

    response.status(200).json(createSuccessResponse("Trusted device verified.", session));
  } catch (error) {
    next(error);
  }
};

export const revokeTrustedDeviceSession: RequestHandler = async (request, response, next) => {
  try {
    const parsedBody = trustedDeviceRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Trusted device revoke request is invalid.", {
        code: "INVALID_TRUSTED_DEVICE_REVOKE_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    await revokeTrustedDevice(parsedBody.data);

    response.status(200).json(createSuccessResponse("Trusted device forgotten."));
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
  // Logout only ends the current active JWT-backed session.
  // Forget device is a separate action that revokes trusted-device auto-login.
  response.status(200).json(createSuccessResponse("Logout successful."));
};
