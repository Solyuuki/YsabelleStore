import { Router } from "express";

import {
  createManagedCategoryController,
  getManagedCategoryController,
  listManagedCategoriesController,
  updateManagedCategoryController
} from "../controllers/categoryController.js";
import {
  approveCategoryImageController,
  getLatestCategoryImageController,
  previewCategoryImageController,
  rejectCategoryImageController,
  removeActiveCategoryCoverController,
  uploadCategoryImageController
} from "../controllers/categoryImageController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { categoryCoverUpload } from "../middleware/uploadMiddleware.js";

export const categoryRouter = Router();

categoryRouter.use(requireAuth);
categoryRouter.get("/", requireRole("OWNER"), listManagedCategoriesController);
categoryRouter.post("/", requireRole("OWNER"), createManagedCategoryController);
categoryRouter.post(
  "/:categoryId/images",
  requireRole("OWNER"),
  categoryCoverUpload.single("image"),
  uploadCategoryImageController
);
categoryRouter.get(
  "/:categoryId/images/latest",
  requireRole("OWNER"),
  getLatestCategoryImageController
);
categoryRouter.get(
  "/:categoryId/images/:imageId/preview/:variant",
  requireRole("OWNER"),
  previewCategoryImageController
);
categoryRouter.post(
  "/:categoryId/images/:imageId/approve",
  requireRole("OWNER"),
  approveCategoryImageController
);
categoryRouter.post(
  "/:categoryId/images/:imageId/reject",
  requireRole("OWNER"),
  rejectCategoryImageController
);
categoryRouter.delete(
  "/:categoryId/cover",
  requireRole("OWNER"),
  removeActiveCategoryCoverController
);
categoryRouter.get("/:id", requireRole("OWNER"), getManagedCategoryController);
categoryRouter.patch("/:id", requireRole("OWNER"), updateManagedCategoryController);
