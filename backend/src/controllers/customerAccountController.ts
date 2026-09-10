import type { Request, RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import {
  changeCustomerPassword,
  claimCustomerUsername,
  listCustomerSessions,
  revokeOtherCustomerSessions,
  updateCustomerProfile
} from "../services/customerAccountService.js";
import { listCustomerOrders } from "../services/storefrontService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import {
  readCustomerSessionCookie,
  setCustomerSessionCookie
} from "../utils/customerAuthCookie.js";
import { HttpError } from "../utils/httpError.js";
import {
  customerPasswordChangeSchema,
  customerProfileUpdateSchema,
  customerSessionRevokeOthersSchema,
  customerUsernameClaimSchema
} from "../validators/customerAccount.validators.js";

function requireCustomer(request: Request) {
  const customer = getAuthenticatedCustomer(request);
  if (!customer) {
    throw new HttpError(401, "Customer session is required.", {
      code: "CUSTOMER_SESSION_REQUIRED"
    });
  }
  return customer;
}

function requireSessionToken(request: Request) {
  const sessionToken = readCustomerSessionCookie(request);
  if (!sessionToken) {
    throw new HttpError(401, "Customer session is required.", {
      code: "CUSTOMER_SESSION_REQUIRED"
    });
  }
  return sessionToken;
}

export const listCustomerOrdersController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const orders = await listCustomerOrders(customer.id);
    response.json(createSuccessResponse("Customer orders loaded.", orders));
  } catch (error) {
    next(error);
  }
};

export const updateCustomerProfileController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const parsedBody = customerProfileUpdateSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer profile update request is invalid.", {
        code: "INVALID_CUSTOMER_PROFILE_UPDATE_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const updatedCustomer = await updateCustomerProfile(customer.id, parsedBody.data);
    response.status(200).json(
      createSuccessResponse("Customer profile updated.", {
        customer: updatedCustomer
      })
    );
  } catch (error) {
    next(error);
  }
};

export const claimCustomerUsernameController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const parsedBody = customerUsernameClaimSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer username claim request is invalid.", {
        code: "INVALID_CUSTOMER_USERNAME_CLAIM_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const updatedCustomer = await claimCustomerUsername(customer.id, parsedBody.data);
    response.status(200).json(
      createSuccessResponse("Customer username claimed.", {
        customer: updatedCustomer
      })
    );
  } catch (error) {
    next(error);
  }
};

export const changeCustomerPasswordController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const sessionToken = requireSessionToken(request);
    const parsedBody = customerPasswordChangeSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer password change request is invalid.", {
        code: "INVALID_CUSTOMER_PASSWORD_CHANGE_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const nextSession = await changeCustomerPassword(customer.id, sessionToken, parsedBody.data);
    setCustomerSessionCookie(response, nextSession.sessionToken);
    response.status(200).json(
      createSuccessResponse("Customer password changed.", {
        customer: nextSession.customer
      })
    );
  } catch (error) {
    next(error);
  }
};

export const listCustomerSessionsController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const sessionToken = requireSessionToken(request);
    const sessions = await listCustomerSessions(customer.id, sessionToken);
    response.status(200).json(createSuccessResponse("Customer sessions loaded.", { sessions }));
  } catch (error) {
    next(error);
  }
};

export const revokeOtherCustomerSessionsController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const customer = requireCustomer(request);
    const sessionToken = requireSessionToken(request);
    const parsedBody = customerSessionRevokeOthersSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer session revocation request is invalid.", {
        code: "INVALID_CUSTOMER_SESSION_REVOCATION_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const revokedCount = await revokeOtherCustomerSessions(
      customer.id,
      sessionToken,
      parsedBody.data
    );
    response.status(200).json(
      createSuccessResponse("Other customer sessions signed out.", {
        revokedCount
      })
    );
  } catch (error) {
    next(error);
  }
};
