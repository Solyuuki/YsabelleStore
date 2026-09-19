import type { RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import {
  paymongoTestKey,
  verifyPaymongoTestSignature
} from "../modules/paymongo/paymongoGateway.js";
import { saveCustomerAddress, saveCustomerOrderAddressSnapshot } from "../services/customerAddressService.js";
import {
  readCustomerPaymongoStatus,
  reconcilePaymongoPaidWebhook,
  startCustomerPaymongoCheckout
} from "../services/paymongoCheckoutService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import { storefrontOrderSchema } from "../validators/storefront.validators.js";

const paymongoOrderSchema = storefrontOrderSchema.omit({ paymentMethod: true });

type PaymongoRequest = Express.Request & { paymongoRawBody?: Buffer };

export const startPaymongoCheckoutController: RequestHandler = async (request, response, next) => {
  try {
    paymongoTestKey();
    const body = parseOrThrow(paymongoOrderSchema, request.body, {
      message: "Online checkout request is invalid.",
      code: "INVALID_PAYMONGO_CHECKOUT"
    });
    const customer = getAuthenticatedCustomer(request);
    const checkout = await startCustomerPaymongoCheckout(
      { ...body, paymentMethod: "CASH_ON_PICKUP" },
      customer ? { customerAccountId: customer.id } : {}
    );
    if (body.customerAddress) {
      await saveCustomerOrderAddressSnapshot(checkout.order.id, body.customerAddress);
      if (customer && body.saveAddressToAccount) {
        await saveCustomerAddress(customer.id, body.customerAddress);
      }
    }
    response.status(201).json(createSuccessResponse("PayMongo test checkout created.", checkout));
  } catch (error) {
    next(error);
  }
};

export const getPaymongoCheckoutStatusController: RequestHandler = async (request, response, next) => {
  try {
    const orderId = request.params.orderId;
    if (!orderId || orderId.length > 191) {
      throw new HttpError(400, "Invalid order reference.", { code: "INVALID_ORDER_REFERENCE" });
    }
    const payment = await readCustomerPaymongoStatus(
      orderId,
      request.header("x-paymongo-order-token")
    );
    response.json(createSuccessResponse("Online checkout status retrieved.", payment));
  } catch (error) {
    next(error);
  }
};

export const paymongoWebhookController: RequestHandler = async (request, response, next) => {
  try {
    paymongoTestKey();
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      throw new HttpError(503, "PayMongo test webhook is not configured.", {
        code: "PAYMONGO_WEBHOOK_NOT_CONFIGURED"
      });
    }
    const rawBody = (request as PaymongoRequest).paymongoRawBody;
    if (!rawBody || !verifyPaymongoTestSignature(
      rawBody, request.header("paymongo-signature"), webhookSecret
    )) {
      throw new HttpError(401, "Invalid PayMongo webhook signature.", {
        code: "PAYMONGO_INVALID_SIGNATURE"
      });
    }
    await reconcilePaymongoPaidWebhook(request.body);
    response.json(createSuccessResponse("PayMongo test webhook processed.", { received: true }));
  } catch (error) {
    next(error);
  }
};
