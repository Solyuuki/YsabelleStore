import { Router } from "express";

import { createCategoryController } from "../controllers/productController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const categoryRouter = Router();

categoryRouter.use(requireAuth);
categoryRouter.post("/", requireRole("OWNER"), createCategoryController);
