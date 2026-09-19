import { Router } from "express";

import { publicProductImageController } from "../controllers/productImageController.js";
import {
  createStorefrontOrderController,
  getStorefrontProductController,
  listStorefrontCategoriesController,
  listStorefrontMerchandisingController,
  listStorefrontProductReviewsController,
  listStorefrontProductsController,
  listStorefrontRelatedProductsController
} from "../controllers/storefrontController.js";
import { optionalCustomerAuth } from "../middleware/customerAuthMiddleware.js";

export const storefrontRouter = Router();

storefrontRouter.get("/product-images/:imageId/:variant", publicProductImageController);
storefrontRouter.get("/categories", listStorefrontCategoriesController);
storefrontRouter.get("/merchandising", listStorefrontMerchandisingController);
storefrontRouter.get("/products", listStorefrontProductsController);
storefrontRouter.get("/products/:id/reviews", listStorefrontProductReviewsController);
storefrontRouter.get("/products/:id/related", listStorefrontRelatedProductsController);
storefrontRouter.get("/products/:id", getStorefrontProductController);
storefrontRouter.post("/orders", optionalCustomerAuth, createStorefrontOrderController);
