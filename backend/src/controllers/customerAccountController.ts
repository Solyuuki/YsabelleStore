import type { RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import { listCustomerOrders } from "../services/storefrontService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";

export const listCustomerOrdersController: RequestHandler = async (request, response, next) => {
  try {
    const customer = getAuthenticatedCustomer(request);
    if (!customer) {
      throw new HttpError(401, "Customer session is required.", {
        code: "CUSTOMER_SESSION_REQUIRED"
      });
    }

    const orders = await listCustomerOrders(customer.id);
    response.json(createSuccessResponse("Customer orders loaded.", orders));
  } catch (error) {
    next(error);
  }
};
