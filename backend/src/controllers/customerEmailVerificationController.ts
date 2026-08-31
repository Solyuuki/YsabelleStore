import type { RequestHandler } from "express";

import {
  requestCustomerEmailRegistrationVerification,
  verifyCustomerEmailRegistrationCode
} from "../services/customerEmailRegistrationService.js";
import { CustomerIdentityEmailDeliveryError } from "../services/customerIdentityEmailDeliveryService.js";
import {
  setCustomerEmailRegistrationCookie
} from "../utils/customerEmailRegistrationCookie.js";
import {
  isCustomerRegistrationIntentValid,
  readCustomerRegistrationIntentCookie
} from "../utils/customerRegistrationIntent.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import {
  customerEmailAuthRequestSchema,
  customerEmailAuthVerifySchema
} from "../validators/customerAuth.validators.js";

const CUSTOMER_REGISTRATION_EMAIL_REQUEST_MESSAGE =
  "If that email address can be used for registration, a verification code will be sent.";

function requireValidRegistrationIntent(request: Parameters<RequestHandler>[0]): string {
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
  return intentToken;
}

export const requestCustomerRegistrationEmailVerification: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const registrationIntentToken = requireValidRegistrationIntent(request);
    const parsedBody = customerEmailAuthRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer registration email verification request is invalid.", {
        code: "INVALID_CUSTOMER_REGISTRATION_EMAIL_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    try {
      await requestCustomerEmailRegistrationVerification({
        email: parsedBody.data.email,
        registrationIntentToken
      });
    } catch (error) {
      if (!(error instanceof CustomerIdentityEmailDeliveryError)) throw error;
      console.error(JSON.stringify({ event: "customer_email_registration_delivery_failed" }));
    }

    response.status(200).json(createSuccessResponse(CUSTOMER_REGISTRATION_EMAIL_REQUEST_MESSAGE));
  } catch (error) {
    next(error);
  }
};

export const verifyCustomerRegistrationEmailVerification: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const registrationIntentToken = requireValidRegistrationIntent(request);
    const parsedBody = customerEmailAuthVerifySchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer registration email verification request is invalid.", {
        code: "INVALID_CUSTOMER_REGISTRATION_EMAIL_VERIFICATION_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const grant = await verifyCustomerEmailRegistrationCode({
      email: parsedBody.data.email,
      verificationCode: parsedBody.data.verificationCode,
      registrationIntentToken
    });
    setCustomerEmailRegistrationCookie(response, grant);
    response.status(200).json(createSuccessResponse("Email address verified for registration."));
  } catch (error) {
    next(error);
  }
};
