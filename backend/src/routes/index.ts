import { Router } from "express";

import { authRouter } from "./auth.routes.js";
import { healthRouter } from "./health.routes.js";
import type { PlannedRouteGroup } from "../types/routeRegistry.js";

export const plannedRouteGroups: readonly PlannedRouteGroup[] = [
  { path: "/api/products", module: "Products", status: "planned" },
  { path: "/api/sales", module: "Sales", status: "planned" },
  { path: "/api/inventory", module: "Inventory", status: "planned" },
  { path: "/api/batches", module: "Batch inventory", status: "planned" },
  { path: "/api/forecasts", module: "Forecasts", status: "planned" },
  { path: "/api/recommendations", module: "Recommendations", status: "planned" },
  { path: "/api/imports", module: "Imports", status: "planned" },
  { path: "/api/reports", module: "Reports", status: "planned" }
];

export const router = Router();

router.use("/auth", authRouter);
router.use("/health", healthRouter);
