import { Router } from "express";

import {
  changeProductStatusController,
  createProductController,
  getProductController,
  listProductsController,
  updateProductController
} from "../controllers/productController.js";
import {
  getProductImportTemplateController,
  importProductsController,
  previewProductImportController
} from "../controllers/productImportController.js";
import { productImportUpload } from "../middleware/uploadMiddleware.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const productRouter = Router();

productRouter.use(requireAuth);

productRouter.get("/import/template", requireRole("OWNER"), getProductImportTemplateController);
productRouter.post(
  "/import/preview",
  requireRole("OWNER"),
  productImportUpload.single("file"),
  previewProductImportController
);
productRouter.post(
  "/import",
  requireRole("OWNER"),
  productImportUpload.single("file"),
  importProductsController
);
productRouter.post("/", requireRole("OWNER"), createProductController);
productRouter.get("/", requireRole("OWNER", "STAFF"), listProductsController);
productRouter.get("/:id", requireRole("OWNER", "STAFF"), getProductController);
productRouter.patch("/:id", requireRole("OWNER"), updateProductController);
productRouter.patch("/:id/status", requireRole("OWNER"), changeProductStatusController);
