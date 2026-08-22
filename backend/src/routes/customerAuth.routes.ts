import { Router } from "express";

import {
  getCurrentCustomer,
  loginCustomerAccount,
  logoutCustomerAccount,
  registerCustomerAccount
} from "../controllers/customerAuthController.js";
import { requireCustomerAuth } from "../middleware/customerAuthMiddleware.js";

export const customerAuthRouter = Router();

customerAuthRouter.post("/register", registerCustomerAccount);
customerAuthRouter.post("/login", loginCustomerAccount);
customerAuthRouter.get("/me", requireCustomerAuth, getCurrentCustomer);
customerAuthRouter.post("/logout", logoutCustomerAccount);
