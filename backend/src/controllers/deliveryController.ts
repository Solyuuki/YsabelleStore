import type { Request, RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import {
  confirmCodCollected,
  listDeliveryTickets,
  updateDeliveryStatus
} from "../services/deliveryService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import {
  codSettlementSchema,
  deliveryListQuerySchema,
  deliveryTicketParamsSchema,
  deliveryTransitionSchema
} from "../validators/delivery.validators.js";

function requireUser(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    throw new HttpError(401, "Authentication token is required.", {
      code: "AUTH_TOKEN_REQUIRED"
    });
  }
  return user;
}

export const listDeliveryTicketsController: RequestHandler = async (request, response, next) => {
  try {
    requireUser(request);
    const parsed = deliveryListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new HttpError(400, "Delivery query is invalid.", {
        code: "INVALID_DELIVERY_QUERY",
        details: parsed.error.flatten()
      });
    }
    const result = await listDeliveryTickets(parsed.data);
    response.status(200).json(
      createSuccessResponse("Delivery tickets loaded.", result.items, {
        ...result.meta,
        summary: result.summary
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryStatusController: RequestHandler = async (request, response, next) => {
  try {
    const user = requireUser(request);
    const params = deliveryTicketParamsSchema.safeParse(request.params);
    const body = deliveryTransitionSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      throw new HttpError(400, "Delivery status request is invalid.", {
        code: "INVALID_DELIVERY_STATUS_REQUEST",
        details: {
          params: params.success ? null : params.error.flatten(),
          body: body.success ? null : body.error.flatten()
        }
      });
    }
    const ticket = await updateDeliveryStatus(params.data.orderId, user.id, body.data);
    response.status(200).json(createSuccessResponse("Delivery status updated.", ticket));
  } catch (error) {
    next(error);
  }
};

export const confirmCodCollectedController: RequestHandler = async (request, response, next) => {
  try {
    const user = requireUser(request);
    const params = deliveryTicketParamsSchema.safeParse(request.params);
    const body = codSettlementSchema.safeParse(request.body ?? {});
    if (!params.success || !body.success) {
      throw new HttpError(400, "COD settlement request is invalid.", {
        code: "INVALID_COD_SETTLEMENT_REQUEST"
      });
    }
    const ticket = await confirmCodCollected(params.data.orderId, user.id, body.data);
    response
      .status(200)
      .json(createSuccessResponse("COD payment collected and order completed.", ticket));
  } catch (error) {
    next(error);
  }
};
