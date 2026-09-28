import { Router } from "express";

import {
  createManagedCategoryController,
  getManagedCategoryController,
  listManagedCategoriesController,
  updateManagedCategoryController
} from "../controllers/categoryController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const categoryRouter = Router();

categoryRouter.use(requireAuth);
categoryRouter.get("/", requireRole("OWNER"), listManagedCategoriesController);
categoryRouter.post("/", requireRole("OWNER"), createManagedCategoryController);
categoryRouter.get("/:id", requireRole("OWNER"), getManagedCategoryController);
categoryRouter.patch("/:id", requireRole("OWNER"), updateManagedCategoryController);
