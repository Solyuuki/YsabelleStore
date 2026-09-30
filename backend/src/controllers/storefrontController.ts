import type { RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import { resolveProductDetailImageUrl } from "../modules/catalog-image/catalogImageUrls.js";
import {
  saveCustomerAddress,
  saveCustomerOrderAddressSnapshot
} from "../services/customerAddressService.js";
import {
  createStorefrontOrder,
  getCustomerReviewContext,
  getStorefrontProduct,
  listStorefrontProductReviews,
  listStorefrontRelatedProducts,
  listStorefrontCategories,
  listStorefrontMerchandising,
  listStorefrontProducts,
  upsertCustomerProductReview
} from "../services/storefrontService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import {
  storefrontOrderSchema,
  storefrontProductParamsSchema,
  storefrontProductQuerySchema,
  storefrontProductReviewMutationSchema,
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

export const getStorefrontProductReviewContextController: RequestHandler = async (
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
    const params = parseOrThrow(storefrontProductParamsSchema, request.params, {
      message: "Storefront product id is invalid.",
      code: "INVALID_STOREFRONT_PRODUCT_ID"
    });
    const context = await getCustomerReviewContext(customer.id, params.id);
    response.json(createSuccessResponse("Customer review context loaded.", context));
  } catch (error) {
    next(error);
  }
};

export const upsertStorefrontProductReviewController: RequestHandler = async (
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
    const params = parseOrThrow(storefrontProductParamsSchema, request.params, {
      message: "Storefront product id is invalid.",
      code: "INVALID_STOREFRONT_PRODUCT_ID"
    });
    const body = parseOrThrow(storefrontProductReviewMutationSchema, request.body, {
      message: "Review request is invalid.",
      code: "INVALID_STOREFRONT_REVIEW_REQUEST"
    });
    const review = await upsertCustomerProductReview(customer.id, params.id, body);
    response.status(200).json(createSuccessResponse("Review saved.", review));
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
      message: "Delivery order request is invalid.",
      code: "INVALID_STOREFRONT_ORDER"
    });
    const customer = getAuthenticatedCustomer(request);
    if (!customer) {
      throw new HttpError(401, "Customer session is required.", {
        code: "CUSTOMER_SESSION_REQUIRED"
      });
    }
    const order = await createStorefrontOrder(body, { customerAccountId: customer.id });

    if (body.customerAddress) {
      await saveCustomerOrderAddressSnapshot(order.id, body.customerAddress);
      if (customer && body.saveAddressToAccount) {
        await saveCustomerAddress(customer.id, body.customerAddress);
      }
    }

    response.status(201).json(createSuccessResponse("Delivery order placed successfully.", order));
  } catch (error) {
    next(error);
  }
};
