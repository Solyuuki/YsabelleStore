import { Router } from "express";

import {
  getCurrentCustomer,
  loginCustomerAccount,
  logoutCustomerAccount,
  registerCustomerAccount
} from "../controllers/customerAuthController.js";
import { createAuthRateLimit } from "../middleware/authRateLimit.js";
import { requireCustomerAuth } from "../middleware/customerAuthMiddleware.js";
import { AUTH_RATE_LIMITS } from "../security/security.constants.js";

export const customerAuthRouter = Router();

const customerRegisterRateLimit = createAuthRateLimit(AUTH_RATE_LIMITS.customerRegister);
const customerLoginRateLimit = createAuthRateLimit(AUTH_RATE_LIMITS.customerLogin);

customerAuthRouter.post("/register", customerRegisterRateLimit, registerCustomerAccount);
customerAuthRouter.post("/login", customerLoginRateLimit, loginCustomerAccount);
customerAuthRouter.get("/me", requireCustomerAuth, getCurrentCustomer);
customerAuthRouter.post("/logout", logoutCustomerAccount);
