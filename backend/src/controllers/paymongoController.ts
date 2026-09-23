import type { RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import {
  createOrReusePaymongoCheckout,
  getStorefrontPaymentStatus,
  handlePaymongoWebhook
} from "../services/paymongoService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import { storefrontOrderPaymentParamsSchema } from "../validators/storefront.validators.js";

export const createPaymongoCheckoutController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const customer = getAuthenticatedCustomer(request);
    if (!customer) {
      throw new HttpError(401, "Customer session is required.", {
        code: "CUSTOMER_SESSION_REQUIRED"
      });
    }

    const params = parseOrThrow(storefrontOrderPaymentParamsSchema, request.params, {
      message: "Order reference is invalid.",
      code: "INVALID_STOREFRONT_ORDER_REFERENCE"
    });
    const checkout = await createOrReusePaymongoCheckout(params.orderNumber, customer.id);

    response.json(createSuccessResponse("PayMongo test checkout is ready.", checkout));
  } catch (error) {
    next(error);
  }
};

export const getStorefrontPaymentStatusController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const customer = getAuthenticatedCustomer(request);
    if (!customer) {
      throw new HttpError(401, "Customer session is required.", {
        code: "CUSTOMER_SESSION_REQUIRED"
      });
    }

    const params = parseOrThrow(storefrontOrderPaymentParamsSchema, request.params, {
      message: "Order reference is invalid.",
      code: "INVALID_STOREFRONT_ORDER_REFERENCE"
    });
    const status = await getStorefrontPaymentStatus(params.orderNumber, customer.id);

    response.json(createSuccessResponse("Order payment status loaded.", status));
  } catch (error) {
    next(error);
  }
};

export const paymongoWebhookController: RequestHandler = async (request, response, next) => {
  try {
    const rawBody = (request as typeof request & { rawBody?: Buffer }).rawBody;

    if (!rawBody) {
      throw new HttpError(400, "PayMongo webhook raw payload is unavailable.", {
        code: "PAYMONGO_WEBHOOK_RAW_BODY_MISSING"
      });
    }

    const signature = request.header("Paymongo-Signature") ?? undefined;
    const result = await handlePaymongoWebhook(rawBody, request.body, signature);

    response.json(createSuccessResponse("PayMongo webhook acknowledged.", result));
  } catch (error) {
    next(error);
  }
};
