import type { RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import { createCustomerSupportTicket } from "../services/customerSupportService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import { customerSupportTicketCreateSchema } from "../validators/customerSupport.validators.js";

export const createCustomerSupportTicketController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const body = parseOrThrow(customerSupportTicketCreateSchema, request.body, {
      message: "Customer support request is invalid.",
      code: "INVALID_CUSTOMER_SUPPORT_REQUEST"
    });
    const ticket = await createCustomerSupportTicket(body, {
      customer: getAuthenticatedCustomer(request)
    });

    response
      .status(201)
      .json(createSuccessResponse("Customer support request submitted.", ticket));
  } catch (error) {
    next(error);
  }
};
