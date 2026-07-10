import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import {
  inventoryIdParamSchema,
  inventoryListQuerySchema,
  lookupInventoryQuerySchema,
  movementHistoryQuerySchema,
  stockAdjustSchema,
  stockDeductionSchema,
  stockInSchema
} from "../validators/inventory.validators.js";
import {
  addStock,
  adjustStock,
  deductStock,
  getInventoryByProductId,
  getMovementHistory,
  listInventory,
  lookupInventoryByBarcode
} from "../services/inventoryService.js";

export const listInventoryController: RequestHandler = async (request, response, next) => {
  try {
    const query = parseOrThrow(inventoryListQuerySchema, request.query, {
      message: "Inventory query is invalid.",
      code: "INVALID_INVENTORY_QUERY"
    });

    const result = await listInventory(query);

    response
      .status(200)
      .json(createSuccessResponse("Inventory loaded successfully.", result.items, result.meta));
  } catch (error) {
    next(error);
  }
};

export const getInventoryByProductController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(inventoryIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });

    const inventory = await getInventoryByProductId(params.productId);

    response.status(200).json(createSuccessResponse("Inventory loaded successfully.", inventory));
  } catch (error) {
    next(error);
  }
};

export const lookupInventoryController: RequestHandler = async (request, response, next) => {
  try {
    const query = parseOrThrow(lookupInventoryQuerySchema, request.query, {
      message: "Barcode lookup is invalid.",
      code: "INVALID_BARCODE_LOOKUP"
    });

    const lookup = await lookupInventoryByBarcode(query.barcode);

    response.status(200).json(createSuccessResponse("Product lookup successful.", lookup));
  } catch (error) {
    next(error);
  }
};

export const stockInController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(inventoryIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });
    const body = parseOrThrow(stockInSchema, request.body, {
      message: "Stock-in request is invalid.",
      code: "INVALID_STOCK_IN_REQUEST"
    });
    const actor = getAuthenticatedUser(request);

    const result = await addStock(params.productId, body, actor?.id);

    response.status(200).json(createSuccessResponse("Stock updated successfully.", result));
  } catch (error) {
    next(error);
  }
};

export const adjustStockController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(inventoryIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });
    const body = parseOrThrow(stockAdjustSchema, request.body, {
      message: "Stock adjustment request is invalid.",
      code: "INVALID_STOCK_ADJUST_REQUEST"
    });
    const actor = getAuthenticatedUser(request);

    const result = await adjustStock(params.productId, body, actor?.id);

    response.status(200).json(createSuccessResponse("Stock adjustment successful.", result));
  } catch (error) {
    next(error);
  }
};

export const deductStockController: RequestHandler = async (request, response, next) => {
  try {
    const body = parseOrThrow(stockDeductionSchema, request.body, {
      message: "Stock deduction request is invalid.",
      code: "INVALID_STOCK_DEDUCTION_REQUEST"
    });
    const actor = getAuthenticatedUser(request);

    const result = await deductStock(body, actor?.id);

    response.status(200).json(createSuccessResponse("Stock deducted successfully.", result));
  } catch (error) {
    next(error);
  }
};

export const movementHistoryController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(inventoryIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });
    const query = parseOrThrow(movementHistoryQuerySchema, request.query, {
      message: "Movement query is invalid.",
      code: "INVALID_MOVEMENT_QUERY"
    });

    const result = await getMovementHistory(params.productId, query);

    response
      .status(200)
      .json(
        createSuccessResponse("Movement history loaded successfully.", result.items, result.meta)
      );
  } catch (error) {
    next(error);
  }
};
