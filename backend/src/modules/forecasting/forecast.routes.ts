import { Router } from "express";

import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireOwner } from "./forecast.auth.js";
import {
  generateForecasts,
  getForecastGenerationSummaryController,
  getForecastProduct,
  getForecastSummaryController,
  listForecastProducts,
  validateForecastData
} from "./forecast.controller.js";

export const forecastRouter = Router();

forecastRouter.use(requireAuth, requireOwner);
forecastRouter.get("/validation", validateForecastData);
forecastRouter.post("/generate", generateForecasts);
forecastRouter.get("/products", listForecastProducts);
forecastRouter.get("/products/:productId", getForecastProduct);
forecastRouter.get("/summary", getForecastSummaryController);
forecastRouter.get("/generation-summary", getForecastGenerationSummaryController);
