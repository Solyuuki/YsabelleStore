import { Router } from "express";

import { search } from "../controllers/searchController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const searchRouter = Router();

searchRouter.get("/", requireAuth, search);
