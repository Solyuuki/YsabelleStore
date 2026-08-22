import type { Request, RequestHandler } from "express";

import {
  getCustomerFromSessionToken,
  type SafeCustomer,
} from "../services/customerAuthService.js";
import { readCustomerSessionCookie } from "../utils/customerAuthCookie.js";
import { HttpError } from "../utils/httpError.js";

type RequestWithCustomerAuth = Request & {
  authCustomer?: SafeCustomer;
};

export function getAuthenticatedCustomer(request: Request): SafeCustomer | undefined {
  return (request as RequestWithCustomerAuth).authCustomer;
}

export const requireCustomerAuth: RequestHandler = async (request, _response, next) => {
  try {
    const sessionToken = readCustomerSessionCookie(request);

    if (!sessionToken) {
      throw new HttpError(401, "Customer session is required.", {
        code: "CUSTOMER_SESSION_REQUIRED",
      });
    }

    (request as RequestWithCustomerAuth).authCustomer =
      await getCustomerFromSessionToken(sessionToken);
    next();
  } catch (error) {
    next(error);
  }
};
