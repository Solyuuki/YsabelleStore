import { Router } from "express";

import { checkoutSale } from "../controllers/posController.js";
import { listProductsForPos } from "../controllers/productsController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const posRouter = Router();

posRouter.get("/products", requireAuth, listProductsForPos);
posRouter.post("/checkout", requireAuth, checkoutSale);
