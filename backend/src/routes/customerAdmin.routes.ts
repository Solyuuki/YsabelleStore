import { Router } from "express";

import {
  getCustomerModerationAccountSummaryController,
  listCustomerAccountsForModerationController,
  listCustomerModerationAuditController,
  listProductReviewsForModerationController,
  updateCustomerModerationStatusController,
  updateProductReviewModerationStatusController
} from "../controllers/customerModerationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const customerAdminRouter = Router();

customerAdminRouter.use(requireAuth, requireRole("OWNER"));
customerAdminRouter.get("/accounts/summary", getCustomerModerationAccountSummaryController);
customerAdminRouter.get("/accounts", listCustomerAccountsForModerationController);
customerAdminRouter.patch("/accounts/:id/status", updateCustomerModerationStatusController);
customerAdminRouter.get("/accounts/:id/audit", listCustomerModerationAuditController);
customerAdminRouter.get("/reviews", listProductReviewsForModerationController);
customerAdminRouter.patch("/reviews/:id/status", updateProductReviewModerationStatusController);
