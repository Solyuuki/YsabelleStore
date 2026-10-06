import type { Request, RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import {
  changeCustomerPassword,
  claimCustomerUsername,
  getCustomerSecuritySummary,
  listCustomerSessions,
  requestCustomerPasswordSetup,
  requestCustomerSessionRevokeVerification,
  revokeOtherCustomerSessions,
  setupCustomerPassword,
  updateCustomerProfile,
  verifyCustomerPasswordSetupCode,
  verifyCustomerSessionRevokeCode
} from "../services/customerAccountService.js";
import { confirmCustomerDeliveryReceived } from "../services/deliveryService.js";
import {
  sendCustomerIdentityVerificationEmail
} from "../services/customerIdentityEmailDeliveryService.js";
import {
  addCustomerFavorite,
  listCustomerFavoriteProducts,
  listCustomerOrders,
  removeCustomerFavorite
} from "../services/storefrontService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import {
  readCustomerSessionCookie,
  setCustomerSessionCookie
} from "../utils/customerAuthCookie.js";
import {
  clearCustomerPasswordSetupGrantCookie,
  readCustomerPasswordSetupGrantCookie,
  setCustomerPasswordSetupGrantCookie
} from "../utils/customerPasswordSetupCookie.js";
import {
  clearCustomerSessionRevokeGrantCookie,
  readCustomerSessionRevokeGrantCookie,
  setCustomerSessionRevokeGrantCookie
} from "../utils/customerSessionRevokeCookie.js";
import { HttpError } from "../utils/httpError.js";
import { customerDeliveryParamsSchema } from "../validators/delivery.validators.js";
import {
  customerPasswordChangeSchema,
  customerPasswordSetupCompleteSchema,
  customerPasswordSetupVerifySchema,
  customerProfileUpdateSchema,
  customerSessionRevokeOthersSchema,
  customerSessionRevokeVerifySchema,
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

export const listCustomerFavoritesController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const favorites = await listCustomerFavoriteProducts(customer.id);
    response.json(createSuccessResponse("Customer favorites loaded.", favorites));
  } catch (error) {
    next(error);
  }
};

export const addCustomerFavoriteController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const productId = String(request.params.productId ?? "").trim();
    if (!productId || productId.length > 191) {
      throw new HttpError(400, "Favorite product id is invalid.", {
        code: "INVALID_CUSTOMER_FAVORITE_PRODUCT"
      });
    }
    const result = await addCustomerFavorite(customer.id, productId);
    response.status(200).json(createSuccessResponse("Product saved to favorites.", result));
  } catch (error) {
    next(error);
  }
};

export const removeCustomerFavoriteController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const productId = String(request.params.productId ?? "").trim();
    if (!productId || productId.length > 191) {
      throw new HttpError(400, "Favorite product id is invalid.", {
        code: "INVALID_CUSTOMER_FAVORITE_PRODUCT"
      });
    }
    const result = await removeCustomerFavorite(customer.id, productId);
    response.status(200).json(createSuccessResponse("Product removed from favorites.", result));
  } catch (error) {
    next(error);
  }
};

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

export const getCustomerSecuritySummaryController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const customer = requireCustomer(request);
    const security = await getCustomerSecuritySummary(customer.id);
    response.status(200).json(createSuccessResponse("Customer security summary loaded.", security));
  } catch (error) {
    next(error);
  }
};

export const requestCustomerPasswordSetupController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const customer = requireCustomer(request);
    clearCustomerPasswordSetupGrantCookie(response);

    await requestCustomerPasswordSetup(customer.id, {
      async sendPasswordSetupEmail({ to, verificationCode }) {
        await sendCustomerIdentityVerificationEmail({
          to,
          verificationCode,
          purpose: "password_setup"
        });
      }
    });

    response.status(200).json(
      createSuccessResponse("A verification code was sent to your account email.")
    );
  } catch (error) {
    next(error);
  }
};

export const verifyCustomerPasswordSetupController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const customer = requireCustomer(request);
    const parsedBody = customerPasswordSetupVerifySchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer password setup verification request is invalid.", {
        code: "INVALID_CUSTOMER_PASSWORD_SETUP_VERIFICATION_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const grant = await verifyCustomerPasswordSetupCode(
      customer.id,
      parsedBody.data.verificationCode
    );
    setCustomerPasswordSetupGrantCookie(response, grant.setupGrant);
    response.status(200).json(
      createSuccessResponse("Verification successful. You can now set a password.")
    );
  } catch (error) {
    clearCustomerPasswordSetupGrantCookie(response);
    next(error);
  }
};

export const setupCustomerPasswordController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const sessionToken = requireSessionToken(request);
    const parsedBody = customerPasswordSetupCompleteSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer password setup request is invalid.", {
        code: "INVALID_CUSTOMER_PASSWORD_SETUP_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const updatedCustomer = await setupCustomerPassword(
      customer.id,
      sessionToken,
      readCustomerPasswordSetupGrantCookie(request) ?? "",
      parsedBody.data.newPassword
    );
    clearCustomerPasswordSetupGrantCookie(response);
    response.status(200).json(
      createSuccessResponse("Password added to your customer account.", {
        customer: updatedCustomer
      })
    );
  } catch (error) {
    clearCustomerPasswordSetupGrantCookie(response);
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

export const requestCustomerSessionRevokeVerificationController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const customer = requireCustomer(request);
    clearCustomerSessionRevokeGrantCookie(response);

    await requestCustomerSessionRevokeVerification(customer.id, {
      async sendSessionRevokeEmail({ to, verificationCode }) {
        await sendCustomerIdentityVerificationEmail({
          to,
          verificationCode,
          purpose: "session_security"
        });
      }
    });

    response
      .status(200)
      .json(createSuccessResponse("A security verification code was sent to your account email."));
  } catch (error) {
    next(error);
  }
};

export const verifyCustomerSessionRevokeVerificationController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const customer = requireCustomer(request);
    const parsedBody = customerSessionRevokeVerifySchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Customer session security verification request is invalid.", {
        code: "INVALID_CUSTOMER_SESSION_REVOKE_VERIFICATION_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const grant = await verifyCustomerSessionRevokeCode(
      customer.id,
      parsedBody.data.verificationCode
    );
    setCustomerSessionRevokeGrantCookie(response, grant.sessionRevokeGrant);
    response
      .status(200)
      .json(createSuccessResponse("Security verification successful."));
  } catch (error) {
    clearCustomerSessionRevokeGrantCookie(response);
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
      parsedBody.data,
      readCustomerSessionRevokeGrantCookie(request) ?? ""
    );
    clearCustomerSessionRevokeGrantCookie(response);
    response.status(200).json(
      createSuccessResponse("Other customer sessions signed out.", {
        revokedCount
      })
    );
  } catch (error) {
    clearCustomerSessionRevokeGrantCookie(response);
    next(error);
  }
};

export const confirmCustomerDeliveryReceivedController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const customer = requireCustomer(request);
    const parsedParams = customerDeliveryParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      throw new HttpError(400, "Delivery confirmation request is invalid.", {
        code: "INVALID_CUSTOMER_DELIVERY_CONFIRMATION",
        details: parsedParams.error.flatten()
      });
    }

    const order = await confirmCustomerDeliveryReceived(parsedParams.data.orderNumber, customer.id);
    response.status(200).json(createSuccessResponse("Delivery receipt confirmed.", order));
  } catch (error) {
    next(error);
  }
};
