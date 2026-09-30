import { Router } from "express";

import {
  confirmCodCollectedController,
  listDeliveryTicketsController,
  updateDeliveryStatusController
} from "../controllers/deliveryController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const deliveryRouter = Router();

deliveryRouter.use(requireAuth);
deliveryRouter.get("/", requireRole("OWNER", "STAFF"), listDeliveryTicketsController);
deliveryRouter.patch(
  "/:orderId/status",
  requireRole("OWNER", "STAFF"),
  updateDeliveryStatusController
);
deliveryRouter.post(
  "/:orderId/cod-collected",
  requireRole("OWNER", "STAFF"),
  confirmCodCollectedController
);
