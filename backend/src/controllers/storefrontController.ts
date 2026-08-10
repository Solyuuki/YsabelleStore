import type { RequestHandler } from "express";

import {
  createStorefrontOrder,
  getStorefrontProduct,
  listStorefrontCategories,
  listStorefrontMerchandising,
  listStorefrontProducts
} from "../services/storefrontService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import {
  storefrontOrderSchema,
  storefrontProductParamsSchema,
  storefrontProductQuerySchema
} from "../validators/storefront.validators.js";

export const listStorefrontCategoriesController: RequestHandler = async (
  _request,
  response,
  next
) => {
  try {
    const categories = await listStorefrontCategories();
    response.json(createSuccessResponse("Storefront categories loaded.", categories));
  } catch (error) {
    next(error);
  }
};

export const listStorefrontProductsController: RequestHandler = async (request, response, next) => {
  try {
    const query = parseOrThrow(storefrontProductQuerySchema, request.query, {
      message: "Storefront product query is invalid.",
      code: "INVALID_STOREFRONT_QUERY"
    });
    const result = await listStorefrontProducts(query);
    response.json(createSuccessResponse("Storefront products loaded.", result.items, result.meta));
  } catch (error) {
    next(error);
  }
};

export const listStorefrontMerchandisingController: RequestHandler = async (
  _request,
  response,
  next
) => {
  try {
    const merchandising = await listStorefrontMerchandising();
    response.json(createSuccessResponse("Storefront merchandising loaded.", merchandising));
  } catch (error) {
    next(error);
  }
};

export const getStorefrontProductController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(storefrontProductParamsSchema, request.params, {
      message: "Storefront product id is invalid.",
      code: "INVALID_STOREFRONT_PRODUCT_ID"
    });
    const product = await getStorefrontProduct(params.id);
    response.json(createSuccessResponse("Storefront product loaded.", product));
  } catch (error) {
    next(error);
  }
};

export const createStorefrontOrderController: RequestHandler = async (request, response, next) => {
  try {
    const body = parseOrThrow(storefrontOrderSchema, request.body, {
      message: "Pickup order request is invalid.",
      code: "INVALID_STOREFRONT_ORDER"
    });
    const order = await createStorefrontOrder(body);
    response.status(201).json(createSuccessResponse("Pickup order placed successfully.", order));
  } catch (error) {
    next(error);
  }
};
