import { Router } from "express";

import {
  confirmHistoricalSalesController,
  getHistoricalSalesBatchController,
  historicalSalesEligibilityController,
  historicalSalesTemplateController,
  listHistoricalSalesBatchesController,
  listHistoricalSalesRowsController,
  previewHistoricalSalesController,
  previewHistoricalSalesRollbackController,
  refreshHistoricalSalesForecastsController,
  rollbackHistoricalSalesController
} from "../controllers/historicalSalesController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { productImportUpload } from "../middleware/uploadMiddleware.js";

export const historicalSalesRouter = Router();

historicalSalesRouter.use(requireAuth, requireRole("OWNER"));
historicalSalesRouter.get("/template", historicalSalesTemplateController);
historicalSalesRouter.post(
  "/preview",
  productImportUpload.single("file"),
  previewHistoricalSalesController
);
historicalSalesRouter.post(
  "/confirm",
  productImportUpload.single("file"),
  confirmHistoricalSalesController
);
historicalSalesRouter.get("/batches", listHistoricalSalesBatchesController);
historicalSalesRouter.get("/batches/:batchId", getHistoricalSalesBatchController);
historicalSalesRouter.get("/batches/:batchId/rows", listHistoricalSalesRowsController);
historicalSalesRouter.get(
  "/batches/:batchId/rollback-impact",
  previewHistoricalSalesRollbackController
);
historicalSalesRouter.post("/batches/:batchId/rollback", rollbackHistoricalSalesController);
historicalSalesRouter.post(
  "/batches/:batchId/refresh-forecasts",
  refreshHistoricalSalesForecastsController
);
historicalSalesRouter.get("/eligibility", historicalSalesEligibilityController);
