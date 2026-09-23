import { Router } from "express";

import { publicProductImageController } from "../controllers/productImageController.js";
import {
  createPaymongoCheckoutController,
  getStorefrontPaymentStatusController,
  paymongoWebhookController
} from "../controllers/paymongoController.js";
import {
  createStorefrontOrderController,
  getStorefrontProductController,
  listStorefrontCategoriesController,
  listStorefrontMerchandisingController,
  listStorefrontProductReviewsController,
  listStorefrontProductsController,
  listStorefrontRelatedProductsController
} from "../controllers/storefrontController.js";
import { requireCustomerAuth } from "../middleware/customerAuthMiddleware.js";

export const storefrontRouter = Router();

storefrontRouter.get("/product-images/:imageId/:variant", publicProductImageController);
storefrontRouter.get("/categories", listStorefrontCategoriesController);
storefrontRouter.get("/merchandising", listStorefrontMerchandisingController);
storefrontRouter.get("/products", listStorefrontProductsController);
storefrontRouter.get("/products/:id/reviews", listStorefrontProductReviewsController);
storefrontRouter.get("/products/:id/related", listStorefrontRelatedProductsController);
storefrontRouter.get("/products/:id", getStorefrontProductController);
storefrontRouter.post("/orders", requireCustomerAuth, createStorefrontOrderController);
storefrontRouter.post(
  "/orders/:orderNumber/paymongo-checkout",
  requireCustomerAuth,
  createPaymongoCheckoutController
);
storefrontRouter.get(
  "/orders/:orderNumber/payment-status",
  requireCustomerAuth,
  getStorefrontPaymentStatusController
);
storefrontRouter.post("/payments/paymongo/webhook", paymongoWebhookController);
