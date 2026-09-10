import type { RequestHandler } from "express";

import { registerCustomer } from "../services/customerAuthService.js";
import { readCustomerEmailRegistrationGrant } from "../services/customerEmailRegistrationService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { setCustomerSessionCookie } from "../utils/customerAuthCookie.js";
import {
  clearCustomerEmailRegistrationCookie,
  readCustomerEmailRegistrationCookie
} from "../utils/customerEmailRegistrationCookie.js";
import {
  clearCustomerRegistrationIntentCookie,
  isCustomerRegistrationIntentValid,
  readCustomerRegistrationIntentCookie
} from "../utils/customerRegistrationIntent.js";
import { hashCustomerRegistrationIntent } from "../utils/customerRegistrationIntentHash.js";
import { HttpError } from "../utils/httpError.js";
import { customerRegisterSchema } from "../validators/customerAuth.validators.js";

function requireValidRegistrationIntent(request: Parameters<RequestHandler>[0]): string {
  const token = readCustomerRegistrationIntentCookie(request);
  if (!token) {
    throw new HttpError(403, "Customer registration intent is required.", {
      code: "CUSTOMER_REGISTRATION_INTENT_REQUIRED"
    });
  }
  if (!isCustomerRegistrationIntentValid(token)) {
    throw new HttpError(403, "Customer registration intent is invalid or expired.", {
      code: "CUSTOMER_REGISTRATION_INTENT_INVALID"
    });
  }
  return token;
}

export const registerVerifiedCustomerAccount: RequestHandler = async (request, response, next) => {
  try {
    const registrationIntentToken = requireValidRegistrationIntent(request);
    const parsedBody = customerRegisterSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer registration request is invalid.", {
        code: "INVALID_CUSTOMER_REGISTER_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const registrationIntentHash = hashCustomerRegistrationIntent(registrationIntentToken);
    const rawEmailGrant = readCustomerEmailRegistrationCookie(request);
    const emailGrant = rawEmailGrant ? readCustomerEmailRegistrationGrant(rawEmailGrant) : null;
    if (
      !emailGrant ||
      emailGrant.registrationIntentHash !== registrationIntentHash ||
      emailGrant.email !== parsedBody.data.email
    ) {
      throw new HttpError(403, "Email address verification is required.", {
        code: "CUSTOMER_EMAIL_REGISTRATION_VERIFICATION_REQUIRED"
      });
    }

    const session = await registerCustomer(parsedBody.data, {
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: null
    });
    setCustomerSessionCookie(response, session.sessionToken);
    clearCustomerEmailRegistrationCookie(response);
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
