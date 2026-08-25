import { Router } from "express";

import { getHealth, getLiveness, getReadiness } from "../controllers/healthController.js";

export const healthRouter = Router();

healthRouter.get("/", getHealth);
healthRouter.get("/live", getLiveness);
healthRouter.get("/ready", getReadiness);
