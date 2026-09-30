import type { Request, RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import {
  changeCustomerPassword,
  claimCustomerUsername,
  listCustomerSessions,
  revokeOtherCustomerSessions,
  updateCustomerProfile
} from "../services/customerAccountService.js";
import { confirmCustomerDeliveryReceived } from "../services/deliveryService.js";
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
import { HttpError } from "../utils/httpError.js";
import { customerDeliveryParamsSchema } from "../validators/delivery.validators.js";
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

    const order = await confirmCustomerDeliveryReceived(
      parsedParams.data.orderNumber,
      customer.id
    );
    response
      .status(200)
      .json(createSuccessResponse("Delivery receipt confirmed.", order));
  } catch (error) {
    next(error);
  }
};
