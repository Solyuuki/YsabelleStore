import { Router } from "express";

import {
  createStorefrontOrderController,
  getStorefrontProductController,
  listStorefrontCategoriesController,
  listStorefrontMerchandisingController,
  listStorefrontProductReviewsController,
  listStorefrontProductsController,
  listStorefrontRelatedProductsController
} from "../controllers/storefrontController.js";

export const storefrontRouter = Router();

storefrontRouter.get("/categories", listStorefrontCategoriesController);
storefrontRouter.get("/merchandising", listStorefrontMerchandisingController);
storefrontRouter.get("/products", listStorefrontProductsController);
storefrontRouter.get("/products/:id/reviews", listStorefrontProductReviewsController);
storefrontRouter.get("/products/:id/related", listStorefrontRelatedProductsController);
storefrontRouter.get("/products/:id", getStorefrontProductController);
storefrontRouter.post("/orders", createStorefrontOrderController);
