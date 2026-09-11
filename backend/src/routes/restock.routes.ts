import { Router } from "express";

import {
  approveRestockOrderController,
  createRestockOrderController,
  getRestockOrderController,
  listRestockOrdersController,
  replaceRestockOrderLinesController,
  updateRestockOrderController
} from "../controllers/restockController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(requireAuth, requireRole("OWNER"));

router.get("/", listRestockOrdersController);
router.post("/", createRestockOrderController);
router.get("/:orderId", getRestockOrderController);
router.patch("/:orderId", updateRestockOrderController);
router.put("/:orderId/lines", replaceRestockOrderLinesController);
router.post("/:orderId/approve", approveRestockOrderController);

export default router;
