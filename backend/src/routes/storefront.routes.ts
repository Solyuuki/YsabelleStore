import { Router } from "express";

import {
  createStorefrontOrderController,
  getStorefrontProductController,
  listStorefrontCategoriesController,
  listStorefrontMerchandisingController,
  listStorefrontProductsController
} from "../controllers/storefrontController.js";

export const storefrontRouter = Router();

storefrontRouter.get("/categories", listStorefrontCategoriesController);
storefrontRouter.get("/merchandising", listStorefrontMerchandisingController);
storefrontRouter.get("/products", listStorefrontProductsController);
storefrontRouter.get("/products/:id", getStorefrontProductController);
storefrontRouter.post("/orders", createStorefrontOrderController);
