import type { RequestHandler } from "express";

import { resolveProductDetailImageUrl } from "../modules/catalog-image/catalogImageUrls.js";
import {
  createStorefrontOrder,
  getStorefrontProduct,
  listStorefrontProductReviews,
  listStorefrontRelatedProducts,
  listStorefrontCategories,
  listStorefrontMerchandising,
  listStorefrontProducts
} from "../services/storefrontService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import {
  storefrontOrderSchema,
  storefrontProductParamsSchema,
  storefrontProductQuerySchema,
  storefrontProductReviewQuerySchema,
  storefrontRelatedProductQuerySchema
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
    response.json(
      createSuccessResponse("Storefront product loaded.", {
        ...product,
        detailImageUrl: resolveProductDetailImageUrl(product.imageUrl)
      })
    );
  } catch (error) {
    next(error);
  }
};

export const listStorefrontProductReviewsController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const params = parseOrThrow(storefrontProductParamsSchema, request.params, {
      message: "Storefront product id is invalid.",
      code: "INVALID_STOREFRONT_PRODUCT_ID"
    });
    const query = parseOrThrow(storefrontProductReviewQuerySchema, request.query, {
      message: "Storefront product review query is invalid.",
      code: "INVALID_STOREFRONT_REVIEW_QUERY"
    });
    const reviews = await listStorefrontProductReviews(params.id, query);
    response.json(createSuccessResponse("Storefront product reviews loaded.", reviews));
  } catch (error) {
    next(error);
  }
};

export const listStorefrontRelatedProductsController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const params = parseOrThrow(storefrontProductParamsSchema, request.params, {
      message: "Storefront product id is invalid.",
      code: "INVALID_STOREFRONT_PRODUCT_ID"
    });
    const query = parseOrThrow(storefrontRelatedProductQuerySchema, request.query, {
      message: "Related product query is invalid.",
      code: "INVALID_STOREFRONT_RELATED_QUERY"
    });
    const related = await listStorefrontRelatedProducts(params.id, query.limit);
    response.json(createSuccessResponse("Related storefront products loaded.", related));
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