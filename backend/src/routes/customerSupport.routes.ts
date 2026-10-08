import { Router, urlencoded } from "express";

import { createCustomerSupportTicketController, viewSupportResolutionController, submitSupportResolutionController } from "../controllers/customerSupportController.js";
import { createAuthRateLimit } from "../middleware/authRateLimit.js";
import { optionalCustomerAuth } from "../middleware/customerAuthMiddleware.js";
import {
  disableSensitiveResponseCaching,
  requireAllowedCustomerAuthOrigin
} from "../middleware/customerAuthSecurity.js";
import { AUTH_RATE_LIMITS } from "../security/security.constants.js";

export const customerSupportRouter = Router();

const customerSupportTicketCreateRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerSupportTicketCreate,
  code: "CUSTOMER_SUPPORT_RATE_LIMITED",
  message: "Too many support requests. Please try again later."
});

const customerSupportResolutionRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerSupportTicketCreate,
  code: "SUPPORT_RESOLUTION_RATE_LIMITED",
  message: "Too many confirmation attempts. Please try again later."
});

customerSupportRouter.use(disableSensitiveResponseCaching);
customerSupportRouter.get("/resolution", viewSupportResolutionController);
customerSupportRouter.post("/resolution", customerSupportResolutionRateLimit, urlencoded({ extended: false, limit: "4kb" }), submitSupportResolutionController);
customerSupportRouter.post(
  "/tickets",
  requireAllowedCustomerAuthOrigin,
  customerSupportTicketCreateRateLimit,
  optionalCustomerAuth,
  createCustomerSupportTicketController
);
