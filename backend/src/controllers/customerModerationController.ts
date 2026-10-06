import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import {
  getCustomerModerationAccountSummary,
  listCustomerAccountsForModeration,
  listCustomerModerationAudit,
  listProductReviewsForModeration,
  updateCustomerModerationStatus,
  updateProductReviewModerationStatus
} from "../services/customerModerationService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import {
  customerAdminListQuerySchema,
  customerAdminParamsSchema,
  customerAdminReviewMutationSchema,
  customerAdminReviewQuerySchema,
  customerAdminStatusMutationSchema
} from "../validators/customerModeration.validators.js";

function requireInternalUserId(request: Parameters<RequestHandler>[0]) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    throw new HttpError(401, "Authentication token is required.", {
      code: "AUTH_TOKEN_REQUIRED"
    });
  }
  return user.id;
}

export const listCustomerAccountsForModerationController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const query = parseOrThrow(customerAdminListQuerySchema, request.query, {
      message: "Customer account query is invalid.",
      code: "INVALID_CUSTOMER_ADMIN_QUERY"
    });
    const result = await listCustomerAccountsForModeration(query);
    response.json(createSuccessResponse("Customer accounts loaded.", result.items, result.meta));
  } catch (error) {
    next(error);
  }
};


export const getCustomerModerationAccountSummaryController: RequestHandler = async (
  _request,
  response,
  next
) => {
  try {
    const result = await getCustomerModerationAccountSummary();
    response.json(createSuccessResponse("Customer account moderation summary loaded.", result));
  } catch (error) {
    next(error);
  }
};

export const updateCustomerModerationStatusController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const actorUserId = requireInternalUserId(request);
    const params = parseOrThrow(customerAdminParamsSchema, request.params, {
      message: "Customer account id is invalid.",
      code: "INVALID_CUSTOMER_ACCOUNT_ID"
    });
    const input = parseOrThrow(customerAdminStatusMutationSchema, request.body, {
      message: "Customer moderation request is invalid.",
      code: "INVALID_CUSTOMER_MODERATION_REQUEST"
    });
    const result = await updateCustomerModerationStatus(params.id, input, actorUserId);
    response.json(createSuccessResponse("Customer account moderation status updated.", result));
  } catch (error) {
    next(error);
  }
};

export const listProductReviewsForModerationController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const query = parseOrThrow(customerAdminReviewQuerySchema, request.query, {
      message: "Product review moderation query is invalid.",
      code: "INVALID_PRODUCT_REVIEW_MODERATION_QUERY"
    });
    const result = await listProductReviewsForModeration(query);
    response.json(createSuccessResponse("Product reviews loaded.", result.items, result.meta));
  } catch (error) {
    next(error);
  }
};

export const updateProductReviewModerationStatusController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const actorUserId = requireInternalUserId(request);
    const params = parseOrThrow(customerAdminParamsSchema, request.params, {
      message: "Product review id is invalid.",
      code: "INVALID_PRODUCT_REVIEW_ID"
    });
    const input = parseOrThrow(customerAdminReviewMutationSchema, request.body, {
      message: "Product review moderation request is invalid.",
      code: "INVALID_PRODUCT_REVIEW_MODERATION_REQUEST"
    });
    const result = await updateProductReviewModerationStatus(params.id, input, actorUserId);
    response.json(createSuccessResponse("Product review moderation status updated.", result));
  } catch (error) {
    next(error);
  }
};

export const listCustomerModerationAuditController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const params = parseOrThrow(customerAdminParamsSchema, request.params, {
      message: "Customer account id is invalid.",
      code: "INVALID_CUSTOMER_ACCOUNT_ID"
    });
    const result = await listCustomerModerationAudit(params.id);
    response.json(createSuccessResponse("Customer moderation history loaded.", result));
  } catch (error) {
    next(error);
  }
};
