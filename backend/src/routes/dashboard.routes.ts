import { Router } from "express";

import {
  getDashboardOperationsController,
  getDashboardSalesCalendarController,
  getDashboardSalesDayController,
  getDashboardSummaryController,
  getNavigationBadgesController,
  setDashboardSalesTargetController
} from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get("/summary", requireRole("OWNER", "STAFF"), getDashboardSummaryController);
dashboardRouter.get("/operations", requireRole("OWNER"), getDashboardOperationsController);
dashboardRouter.get(
  "/sales-calendar",
  requireRole("OWNER", "STAFF"),
  getDashboardSalesCalendarController
);
dashboardRouter.get(
  "/sales-calendar/day",
  requireRole("OWNER", "STAFF"),
  getDashboardSalesDayController
);
dashboardRouter.put(
  "/sales-calendar/targets/:date",
  requireRole("OWNER"),
  setDashboardSalesTargetController
);
dashboardRouter.get(
  "/navigation-badges",
  requireRole("OWNER", "STAFF"),
  getNavigationBadgesController
);
