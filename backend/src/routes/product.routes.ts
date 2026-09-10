import { Router } from "express";

import {
  approveProductImageController,
  getLatestProductImageController,
  previewProductImageController,
  rejectProductImageController,
  uploadProductImageController
} from "../controllers/productImageController.js";
import {
  listProductBarcodesController,
  registerProductBarcodeController,
  setPrimaryProductBarcodeController
} from "../controllers/productBarcodeController.js";
import {
  changeProductStatusController,
  createProductController,
  getProductController,
  listProductsController,
  listCategoriesController,
  updateProductController
} from "../controllers/productController.js";
import {
  importGoogleDriveProductsController,
  importProductsController,
  previewGoogleDriveProductImportController,
  previewProductImportController
} from "../controllers/productImportController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { productImageUpload, productImportUpload } from "../middleware/uploadMiddleware.js";

export const productRouter = Router();

productRouter.use(requireAuth);

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
productRouter.post(
  "/import/google-drive/preview",
  requireRole("OWNER"),
  previewGoogleDriveProductImportController
);
productRouter.post(
  "/import/google-drive",
  requireRole("OWNER"),
  importGoogleDriveProductsController
);
productRouter.get("/categories", requireRole("OWNER", "STAFF"), listCategoriesController);
productRouter.post("/", requireRole("OWNER"), createProductController);
productRouter.get("/", requireRole("OWNER", "STAFF"), listProductsController);
productRouter.get(
  "/:productId/barcodes",
  requireRole("OWNER", "STAFF"),
  listProductBarcodesController
);
productRouter.post("/:productId/barcodes", requireRole("OWNER"), registerProductBarcodeController);
productRouter.patch(
  "/:productId/barcodes/:barcodeId/primary",
  requireRole("OWNER"),
  setPrimaryProductBarcodeController
);
productRouter.post(
  "/:id/images",
  requireRole("OWNER"),
  productImageUpload.single("image"),
  uploadProductImageController
);
productRouter.get(
  "/:productId/images/latest",
  requireRole("OWNER"),
  getLatestProductImageController
);
productRouter.get(
  "/:productId/images/:imageId/preview/:variant",
  requireRole("OWNER"),
  previewProductImageController
);
productRouter.post(
  "/:productId/images/:imageId/approve",
  requireRole("OWNER"),
  approveProductImageController
);
productRouter.post(
  "/:productId/images/:imageId/reject",
  requireRole("OWNER"),
  rejectProductImageController
);
productRouter.get("/:id", requireRole("OWNER", "STAFF"), getProductController);
productRouter.patch("/:id", requireRole("OWNER"), updateProductController);
productRouter.patch("/:id/status", requireRole("OWNER"), changeProductStatusController);
