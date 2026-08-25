import type { RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import {
  loginCustomer,
  registerCustomer,
  revokeCustomerSession
} from "../services/customerAuthService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import {
  clearCustomerSessionCookie,
  readCustomerSessionCookie,
  setCustomerSessionCookie
} from "../utils/customerAuthCookie.js";
import { HttpError } from "../utils/httpError.js";
import {
  customerLoginSchema,
  customerRegisterSchema
} from "../validators/customerAuth.validators.js";

export const registerCustomerAccount: RequestHandler = async (request, response, next) => {
  try {
    const parsedBody = customerRegisterSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer registration request is invalid.", {
        code: "INVALID_CUSTOMER_REGISTER_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const session = await registerCustomer(parsedBody.data);
    setCustomerSessionCookie(response, session.sessionToken);

    response.status(201).json(
      createSuccessResponse("Customer registration successful.", {
        customer: session.customer
      })
    );
  } catch (error) {
    next(error);
  }
};

export const loginCustomerAccount: RequestHandler = async (request, response, next) => {
  try {
    const parsedBody = customerLoginSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer login request is invalid.", {
        code: "INVALID_CUSTOMER_LOGIN_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const session = await loginCustomer(parsedBody.data);
    setCustomerSessionCookie(response, session.sessionToken);

    response.status(200).json(
      createSuccessResponse("Customer login successful.", {
        customer: session.customer
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getCurrentCustomer: RequestHandler = (request, response, next) => {
  const customer = getAuthenticatedCustomer(request);
  if (!customer) {
    next(
      new HttpError(401, "Customer session is required.", {
        code: "CUSTOMER_SESSION_REQUIRED"
      })
    );
    return;
  }

  response.status(200).json(createSuccessResponse("Current customer loaded.", { customer }));
};

export const logoutCustomerAccount: RequestHandler = async (request, response, next) => {
  try {
    const sessionToken = readCustomerSessionCookie(request);
    if (sessionToken) {
      await revokeCustomerSession(sessionToken);
    }

    clearCustomerSessionCookie(response);
    response.status(200).json(createSuccessResponse("Customer logout successful."));
  } catch (error) {
    next(error);
  }
};
