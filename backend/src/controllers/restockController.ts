import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import {
  approveRestockOrderSchema,
  createRestockOrderSchema,
  replaceRestockOrderLinesSchema,
  restockOrderIdParamSchema,
  restockOrderListQuerySchema,
  updateRestockOrderSchema
} from "../validators/restock.validators.js";
import {
  approveRestockOrder,
  createRestockOrder,
  getRestockOrder,
  listRestockOrders,
  replaceRestockOrderLines,
  updateRestockOrder
} from "../services/restockService.js";

function requireActorId(request: Parameters<RequestHandler>[0]) {
  const actorId = getAuthenticatedUser(request)?.id;
  if (!actorId) {
    throw new Error("Authenticated restock requests require an actor id.");
  }
  return actorId;
}

export const listRestockOrdersController: RequestHandler = async (request, response, next) => {
  try {
    const query = parseOrThrow(restockOrderListQuerySchema, request.query, {
      message: "Restock order query is invalid.",
      code: "INVALID_RESTOCK_ORDER_QUERY"
    });
    const result = await listRestockOrders(query);

    response
      .status(200)
      .json(createSuccessResponse("Restock orders loaded successfully.", result.items, result.meta));
  } catch (error) {
    next(error);
  }
};

export const createRestockOrderController: RequestHandler = async (request, response, next) => {
  try {
    const body = parseOrThrow(createRestockOrderSchema, request.body, {
      message: "Restock order request is invalid.",
      code: "INVALID_RESTOCK_ORDER_REQUEST"
    });
    const order = await createRestockOrder(body, requireActorId(request));

    response.status(201).json(createSuccessResponse("Restock draft created successfully.", order));
  } catch (error) {
    next(error);
  }
};

export const getRestockOrderController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(restockOrderIdParamSchema, request.params, {
      message: "Restock order id is invalid.",
      code: "INVALID_RESTOCK_ORDER_ID"
    });
    const order = await getRestockOrder(params.orderId);

    response.status(200).json(createSuccessResponse("Restock order loaded successfully.", order));
  } catch (error) {
    next(error);
  }
};

export const updateRestockOrderController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(restockOrderIdParamSchema, request.params, {
      message: "Restock order id is invalid.",
      code: "INVALID_RESTOCK_ORDER_ID"
    });
    const body = parseOrThrow(updateRestockOrderSchema, request.body, {
      message: "Restock order update is invalid.",
      code: "INVALID_RESTOCK_ORDER_UPDATE"
    });
    const order = await updateRestockOrder(params.orderId, body);

    response.status(200).json(createSuccessResponse("Restock draft updated successfully.", order));
  } catch (error) {
    next(error);
  }
};

export const replaceRestockOrderLinesController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const params = parseOrThrow(restockOrderIdParamSchema, request.params, {
      message: "Restock order id is invalid.",
      code: "INVALID_RESTOCK_ORDER_ID"
    });
    const body = parseOrThrow(replaceRestockOrderLinesSchema, request.body, {
      message: "Restock order lines are invalid.",
      code: "INVALID_RESTOCK_ORDER_LINES"
    });
    const order = await replaceRestockOrderLines(params.orderId, body);

    response.status(200).json(createSuccessResponse("Restock lines updated successfully.", order));
  } catch (error) {
    next(error);
  }
};

export const approveRestockOrderController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(restockOrderIdParamSchema, request.params, {
      message: "Restock order id is invalid.",
      code: "INVALID_RESTOCK_ORDER_ID"
    });
    const body = parseOrThrow(approveRestockOrderSchema, request.body, {
      message: "Restock approval request is invalid.",
      code: "INVALID_RESTOCK_APPROVAL_REQUEST"
    });
    const order = await approveRestockOrder(params.orderId, body, requireActorId(request));

    response.status(200).json(createSuccessResponse("Restock order approved successfully.", order));
  } catch (error) {
    next(error);
  }
};
