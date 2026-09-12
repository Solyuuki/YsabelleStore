import { Router } from "express";

import {
  approveRestockOrderController,
  cancelRestockOrderController,
  createRestockOrderController,
  dismissRestockRecommendationController,
  getRestockOrderController,
  listRestockOrdersController,
  listRestockPlanningController,
  markRestockOrderAwaitingDeliveryController,
  receiveRestockOrderController,
  replaceRestockOrderLinesController,
  updateRestockOrderController
} from "../controllers/restockController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// Staff may submit a custom procurement request, but approval and every lifecycle action
// remain Owner-controlled. Owner requests may use either this endpoint or the normal draft API.
router.post(
  "/requests",
  requireAuth,
  requireRole("OWNER", "STAFF"),
  createRestockOrderController
);

router.use(requireAuth, requireRole("OWNER"));

router.get("/planning", listRestockPlanningController);
router.post("/recommendations/:recommendationId/dismiss", dismissRestockRecommendationController);
router.get("/", listRestockOrdersController);
router.post("/", createRestockOrderController);
router.get("/:orderId", getRestockOrderController);
router.patch("/:orderId", updateRestockOrderController);
router.put("/:orderId/lines", replaceRestockOrderLinesController);
router.post("/:orderId/approve", approveRestockOrderController);
router.post("/:orderId/await-delivery", markRestockOrderAwaitingDeliveryController);
router.post("/:orderId/cancel", cancelRestockOrderController);
router.post("/:orderId/receipts", receiveRestockOrderController);

export default router;
