import type { RequestHandler } from "express";

import {
  createManagedCategory,
  getManagedCategory,
  listManagedCategories,
  updateManagedCategory
} from "../services/categoryManagementService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import {
  categoryIdParamSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema
} from "../validators/category.validators.js";

export const listManagedCategoriesController: RequestHandler = async (request, response, next) => {
  try {
    const query = parseOrThrow(listCategoriesQuerySchema, request.query, {
      message: "Category query is invalid.",
      code: "INVALID_CATEGORY_QUERY"
    });
    const result = await listManagedCategories(query);
    response
      .status(200)
      .json(createSuccessResponse("Categories loaded successfully.", result.items, result.meta));
  } catch (error) {
    next(error);
  }
};

export const getManagedCategoryController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(categoryIdParamSchema, request.params, {
      message: "Category id is invalid.",
      code: "INVALID_CATEGORY_ID"
    });
    const category = await getManagedCategory(params.id);
    response.status(200).json(createSuccessResponse("Category loaded successfully.", category));
  } catch (error) {
    next(error);
  }
};

export const createManagedCategoryController: RequestHandler = async (request, response, next) => {
  try {
    const body = parseOrThrow(createCategorySchema, request.body, {
      message: "Category request is invalid.",
      code: "INVALID_CATEGORY_REQUEST"
    });
    const category = await createManagedCategory(body);
    response.status(201).json(createSuccessResponse("Category created successfully.", category));
  } catch (error) {
    next(error);
  }
};

export const updateManagedCategoryController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(categoryIdParamSchema, request.params, {
      message: "Category id is invalid.",
      code: "INVALID_CATEGORY_ID"
    });
    const body = parseOrThrow(updateCategorySchema, request.body, {
      message: "Category update request is invalid.",
      code: "INVALID_CATEGORY_UPDATE_REQUEST"
    });
    const category = await updateManagedCategory(params.id, body);
    response.status(200).json(createSuccessResponse("Category updated successfully.", category));
  } catch (error) {
    next(error);
  }
};
