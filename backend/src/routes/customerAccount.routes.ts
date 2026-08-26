import { Router } from "express";

import { listCustomerOrdersController } from "../controllers/customerAccountController.js";
import { requireCustomerAuth } from "../middleware/customerAuthMiddleware.js";
import { disableSensitiveResponseCaching } from "../middleware/customerAuthSecurity.js";

export const customerAccountRouter = Router();

customerAccountRouter.use(disableSensitiveResponseCaching);
customerAccountRouter.get("/orders", requireCustomerAuth, listCustomerOrdersController);
