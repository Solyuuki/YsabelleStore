import type { RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import {
  loginCustomer,
  registerCustomer,
  revokeCustomerSession
} from "../services/customerAuthService.js";
import {
  CustomerRecoveryEmailDeliveryError,
  customerRecoveryEmailDelivery
} from "../services/customerRecoveryEmailService.js";
import {
  requestCustomerPasswordRecovery,
  resetCustomerPassword
} from "../services/customerPasswordRecoveryService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import {
  clearCustomerSessionCookie,
  readCustomerSessionCookie,
  setCustomerSessionCookie
} from "../utils/customerAuthCookie.js";
import {
  clearCustomerRegistrationIntentCookie,
  createCustomerRegistrationIntent,
  isCustomerRegistrationIntentValid,
  readCustomerRegistrationIntentCookie,
  setCustomerRegistrationIntentCookie
} from "../utils/customerRegistrationIntent.js";
import { HttpError } from "../utils/httpError.js";
import {
  customerLoginSchema,
  customerPasswordRecoveryRequestSchema,
  customerPasswordResetSchema,
  customerRegisterSchema
} from "../validators/customerAuth.validators.js";

const CUSTOMER_RECOVERY_REQUEST_MESSAGE =
  "If an eligible account exists, recovery instructions have been sent to its registered email.";

export const issueCustomerRegistrationIntent: RequestHandler = (_request, response) => {
  const intentToken = createCustomerRegistrationIntent();
  setCustomerRegistrationIntentCookie(response, intentToken);
  response.status(200).json(
    createSuccessResponse("Customer registration intent issued.", {
      ready: true
    })
  );
};

export const registerCustomerAccount: RequestHandler = async (request, response, next) => {
  try {
    const intentToken = readCustomerRegistrationIntentCookie(request);
    if (!intentToken) {
      throw new HttpError(403, "Customer registration intent is required.", {
        code: "CUSTOMER_REGISTRATION_INTENT_REQUIRED"
      });
    }

    if (!isCustomerRegistrationIntentValid(intentToken)) {
      throw new HttpError(403, "Customer registration intent is invalid or expired.", {
        code: "CUSTOMER_REGISTRATION_INTENT_INVALID"
      });
    }

    const parsedBody = customerRegisterSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer registration request is invalid.", {
        code: "INVALID_CUSTOMER_REGISTER_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const session = await registerCustomer(parsedBody.data);
    setCustomerSessionCookie(response, session.sessionToken);
    clearCustomerRegistrationIntentCookie(response);

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

export const requestCustomerPasswordRecoveryAccount: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const parsedBody = customerPasswordRecoveryRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer recovery request is invalid.", {
        code: "INVALID_CUSTOMER_RECOVERY_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    try {
      await requestCustomerPasswordRecovery(parsedBody.data, customerRecoveryEmailDelivery);
    } catch (error) {
      if (!(error instanceof CustomerRecoveryEmailDeliveryError)) throw error;
      console.error(JSON.stringify({ event: "customer_recovery_delivery_failed" }));
    }

    response.status(200).json(createSuccessResponse(CUSTOMER_RECOVERY_REQUEST_MESSAGE));
  } catch (error) {
    next(error);
  }
};

export const resetCustomerPasswordAccount: RequestHandler = async (request, response, next) => {
  try {
    const parsedBody = customerPasswordResetSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer password reset request is invalid.", {
        code: "INVALID_CUSTOMER_PASSWORD_RESET_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    await resetCustomerPassword(parsedBody.data);
    clearCustomerSessionCookie(response);
    response
      .status(200)
      .json(createSuccessResponse("Password reset successful. Sign in with your new password."));
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
