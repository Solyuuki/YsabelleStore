import { Router } from "express";

import { listProductsForPos } from "../controllers/productsController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const productsRouter = Router();

productsRouter.get("/", requireAuth, listProductsForPos);
