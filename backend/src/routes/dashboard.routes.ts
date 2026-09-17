import { Router } from "express";

import {
  getDashboardOperationsController,
  getDashboardSummaryController,
  getNavigationBadgesController
} from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get("/summary", requireRole("OWNER", "STAFF"), getDashboardSummaryController);
dashboardRouter.get("/operations", requireRole("OWNER"), getDashboardOperationsController);
dashboardRouter.get(
  "/navigation-badges",
  requireRole("OWNER", "STAFF"),
  getNavigationBadgesController
);
