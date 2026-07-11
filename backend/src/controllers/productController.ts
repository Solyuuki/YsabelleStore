import type { RequestHandler } from "express";

import { createSuccessResponse } from "../utils/apiResponse.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import { createCategorySchema } from "../validators/category.validators.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  productAvailabilityStatusSchema,
  productIdParamSchema,
  updateProductSchema
} from "../validators/product.validators.js";
import {
  changeProductStatus,
  createCategory,
  createProduct,
  listCategories,
  getProductById,
  listProducts,
  updateProduct
} from "../services/productService.js";

export const createProductController: RequestHandler = async (request, response, next) => {
  try {
    const body = parseOrThrow(createProductSchema, request.body, {
      message: "Product request is invalid.",
      code: "INVALID_PRODUCT_REQUEST"
    });

    const product = await createProduct(body);

    response.status(201).json(createSuccessResponse("Product created successfully.", product));
  } catch (error) {
    next(error);
  }
};

export const listCategoriesController: RequestHandler = async (_request, response, next) => {
  try {
    const categories = await listCategories();

    response.status(200).json(createSuccessResponse("Categories loaded successfully.", categories));
  } catch (error) {
    next(error);
  }
};

export const createCategoryController: RequestHandler = async (request, response, next) => {
  try {
    const body = parseOrThrow(createCategorySchema, request.body, {
      message: "Category request is invalid.",
      code: "INVALID_CATEGORY_REQUEST"
    });

    const category = await createCategory(body);

    response.status(201).json(createSuccessResponse("Category created successfully.", category));
  } catch (error) {
    next(error);
  }
};

export const listProductsController: RequestHandler = async (request, response, next) => {
  try {
    const query = parseOrThrow(listProductsQuerySchema, request.query, {
      message: "Product query is invalid.",
      code: "INVALID_PRODUCT_QUERY"
    });

    const result = await listProducts(query);

    response
      .status(200)
      .json(createSuccessResponse("Products loaded successfully.", result.items, result.meta));
  } catch (error) {
    next(error);
  }
};

export const getProductController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(productIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });

    const product = await getProductById(params.id);

    response.status(200).json(createSuccessResponse("Product loaded successfully.", product));
  } catch (error) {
    next(error);
  }
};

export const updateProductController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(productIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });

    const body = parseOrThrow(updateProductSchema, request.body, {
      message: "Product update request is invalid.",
      code: "INVALID_PRODUCT_UPDATE_REQUEST"
    });

    const product = await updateProduct(params.id, body);

    response.status(200).json(createSuccessResponse("Product updated successfully.", product));
  } catch (error) {
    next(error);
  }
};

export const changeProductStatusController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(productIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });

    const body = parseOrThrow(productAvailabilityStatusSchema, request.body, {
      message: "Product availability request is invalid.",
      code: "INVALID_PRODUCT_AVAILABILITY_REQUEST"
    });

    const product = await changeProductStatus(params.id, body);

    response
      .status(200)
      .json(createSuccessResponse("Product status updated successfully.", product));
  } catch (error) {
    next(error);
  }
};
