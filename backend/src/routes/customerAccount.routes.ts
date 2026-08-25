import { Router } from "express";

import { listCustomerOrdersController } from "../controllers/customerAccountController.js";
import { requireCustomerAuth } from "../middleware/customerAuthMiddleware.js";

export const customerAccountRouter = Router();

customerAccountRouter.get("/orders", requireCustomerAuth, listCustomerOrdersController);
