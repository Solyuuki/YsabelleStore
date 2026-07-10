import { Router } from "express";

import {
  adjustStockController,
  deductStockController,
  getInventoryByProductController,
  listInventoryController,
  lookupInventoryController,
  movementHistoryController,
  stockInController
} from "../controllers/inventoryController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

inventoryRouter.get("/", requireRole("OWNER", "STAFF"), listInventoryController);
inventoryRouter.get("/lookup", requireRole("OWNER", "STAFF"), lookupInventoryController);
inventoryRouter.get(
  "/product/:productId",
  requireRole("OWNER", "STAFF"),
  getInventoryByProductController
);
inventoryRouter.post("/deduct", requireRole("OWNER", "STAFF"), deductStockController);
inventoryRouter.post("/:productId/stock-in", requireRole("OWNER"), stockInController);
inventoryRouter.post("/:productId/adjust", requireRole("OWNER"), adjustStockController);
inventoryRouter.get(
  "/:productId/movements",
  requireRole("OWNER", "STAFF"),
  movementHistoryController
);
