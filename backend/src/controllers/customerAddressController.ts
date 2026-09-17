import type { Request, RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import {
  getCustomerSavedAddress,
  saveCustomerAddress
} from "../services/customerAddressService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { customerAddressSchema } from "../validators/customerAddress.validators.js";

function requireCustomer(request: Request) {
  const customer = getAuthenticatedCustomer(request);
  if (!customer) {
    throw new HttpError(401, "Customer session is required.", {
      code: "CUSTOMER_SESSION_REQUIRED"
    });
  }
  return customer;
}

export const getCustomerAddressController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const address = await getCustomerSavedAddress(customer.id);
    response.json(createSuccessResponse("Customer address loaded.", { address }));
  } catch (error) {
    next(error);
  }
};

export const updateCustomerAddressController: RequestHandler = async (request, response, next) => {
  try {
    const customer = requireCustomer(request);
    const parsed = customerAddressSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "Customer address is invalid.", {
        code: "INVALID_CUSTOMER_ADDRESS",
        details: parsed.error.flatten()
      });
    }

    const address = await saveCustomerAddress(customer.id, parsed.data);
    response.json(createSuccessResponse("Customer address updated.", { address }));
  } catch (error) {
    next(error);
  }
};
