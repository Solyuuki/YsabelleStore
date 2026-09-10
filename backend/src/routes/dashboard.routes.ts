import { Router } from "express";

import { getDashboardSummaryController } from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get("/summary", requireRole("OWNER", "STAFF"), getDashboardSummaryController);
