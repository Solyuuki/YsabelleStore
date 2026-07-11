import { Router } from "express";

import { authRouter } from "./auth.routes.js";
import { inventoryRouter } from "./inventory.routes.js";
import { categoryRouter } from "./category.routes.js";
import { healthRouter } from "./health.routes.js";
import { posRouter } from "./pos.routes.js";
import { productsRouter } from "./products.routes.js";
import { productRouter } from "./product.routes.js";
import { salesRouter } from "./sales.routes.js";
import { searchRouter } from "./search.routes.js";
import type { RouteGroup } from "../types/routeRegistry.js";

export const apiRouteGroups: readonly RouteGroup[] = [
  { path: "/api/products", module: "POS product search", status: "implemented" },
  { path: "/api/catalog/products", module: "Catalog products", status: "implemented" },
  { path: "/api/catalog/categories", module: "Catalog categories", status: "implemented" },
  { path: "/api/sales", module: "Sales", status: "planned" },
  { path: "/api/inventory", module: "Inventory", status: "implemented" },
  { path: "/api/batches", module: "Batch inventory", status: "planned" },
  { path: "/api/forecasts", module: "Forecasts", status: "planned" },
  { path: "/api/recommendations", module: "Recommendations", status: "planned" },
  { path: "/api/imports", module: "Imports", status: "planned" },
  { path: "/api/reports", module: "Reports", status: "planned" }
];

export const router = Router();

router.use("/auth", authRouter);
router.use("/health", healthRouter);
router.use("/products", productsRouter);
router.use("/pos", posRouter);
router.use("/catalog/products", productRouter);
router.use("/catalog/categories", categoryRouter);
router.use("/inventory", inventoryRouter);
router.use("/sales", salesRouter);
router.use("/search", searchRouter);
