import { Router } from "express";

import { listSales } from "../controllers/salesController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const salesRouter = Router();

salesRouter.get("/", requireAuth, listSales);
