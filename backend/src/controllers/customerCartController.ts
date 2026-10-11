import type { Request, RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import {
  clearCustomerCart,
  listCustomerCart,
  mergeCustomerCart,
  removeCustomerCartItem,
  setCustomerCartItem
} from "../services/customerCartService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import {
  customerCartMergeSchema,
  customerCartProductParamsSchema,
  customerCartQuantitySchema
} from "../validators/customerCart.validators.js";

function requireCustomer(request: Request) {
  const customer = getAuthenticatedCustomer(request);
  if (!customer) {
    throw new HttpError(401, "Customer session is required.", {
      code: "CUSTOMER_SESSION_REQUIRED"
    });
  }
  return customer;
}

export const getCustomerCartController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const items = await listCustomerCart(customer.id);
    response.json(createSuccessResponse("Customer cart loaded.", { items }));
  } catch (error) {
    next(error);
  }
};

export const mergeCustomerCartController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const body = parseOrThrow(customerCartMergeSchema, request.body, {
      message: "Customer cart merge request is invalid.",
      code: "INVALID_CUSTOMER_CART_MERGE"
    });
    const items = await mergeCustomerCart(customer.id, body.items);
    response.json(createSuccessResponse("Guest cart merged into customer account.", { items }));
  } catch (error) {
    next(error);
  }
};

export const setCustomerCartItemController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const params = parseOrThrow(customerCartProductParamsSchema, request.params, {
      message: "Customer cart product id is invalid.",
      code: "INVALID_CUSTOMER_CART_PRODUCT"
    });
    const body = parseOrThrow(customerCartQuantitySchema, request.body, {
      message: "Customer cart quantity is invalid.",
      code: "INVALID_CUSTOMER_CART_QUANTITY"
    });
    const items = await setCustomerCartItem(customer.id, params.productId, body.quantity);
    response.json(createSuccessResponse("Customer cart item updated.", { items }));
  } catch (error) {
    next(error);
  }
};

export const removeCustomerCartItemController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const params = parseOrThrow(customerCartProductParamsSchema, request.params, {
      message: "Customer cart product id is invalid.",
      code: "INVALID_CUSTOMER_CART_PRODUCT"
    });
    const items = await removeCustomerCartItem(customer.id, params.productId);
    response.json(createSuccessResponse("Customer cart item removed.", { items }));
  } catch (error) {
    next(error);
  }
};

export const clearCustomerCartController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    await clearCustomerCart(customer.id);
    response.json(createSuccessResponse("Customer cart cleared."));
  } catch (error) {
    next(error);
  }
};
