import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../../constants/httpStatusContract.js";
import { createSuccessResponse } from "../../utils/apiResponse.js";
import { HttpError } from "../../utils/httpError.js";
import { withReconstructedComparisonOverlay } from "./forecast-comparison-overlay.service.js";
import { withRealizedAccuracyFeedback } from "./forecast-realized-accuracy.service.js";
import {
  forecastDetailQuerySchema,
  forecastGenerateBodySchema,
  forecastListQuerySchema
} from "./forecast.schemas.js";
import {
  getForecastGenerationSummary,
  getForecastProductDetail,
  getForecastProductList,
  getForecastSummary,
  requestForecastRefresh,
  validateHistoricalSales
} from "./forecast.service.js";

export const validateForecastData: RequestHandler = async (_request, response, next) => {
  try {
    const result = await validateHistoricalSales();

    response
      .status(200)
      .json(createSuccessResponse("Historical sales validation completed.", result));
  } catch (error) {
    next(error);
  }
};

export const generateForecasts: RequestHandler = async (request, response, next) => {
  try {
    const parsedBody = forecastGenerateBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Forecast generation request is invalid.", {
        code: "INVALID_FORECAST_GENERATE_REQUEST",
        details: parsedBody.error.flatten()
      });
    }

    const result = await requestForecastRefresh({ force: parsedBody.data.force });

    response
      .status(HTTP_STATUS.ACCEPTED)
      .json(createSuccessResponse("Forecast refresh accepted.", result));
  } catch (error) {
    next(error);
  }
};

export const listForecastProducts: RequestHandler = async (request, response, next) => {
  try {
    const parsedQuery = forecastListQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      throw new HttpError(400, "Forecast product query is invalid.", {
        code: "INVALID_FORECAST_QUERY",
        details: parsedQuery.error.flatten()
      });
    }

    const result = await getForecastProductList(parsedQuery.data);

    response.status(200).json(createSuccessResponse("Forecast products loaded.", result));
  } catch (error) {
    next(error);
  }
};

export const getForecastProduct: RequestHandler = async (request, response, next) => {
  try {
    const productId = request.params.productId?.trim();

    if (!productId) {
      throw new HttpError(400, "Product ID is required.", {
        code: "FORECAST_PRODUCT_ID_REQUIRED"
      });
    }

    const parsedQuery = forecastDetailQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      throw new HttpError(400, "Forecast detail query is invalid.", {
        code: "INVALID_FORECAST_DETAIL_QUERY",
        details: parsedQuery.error.flatten()
      });
    }

    const persistedDetail = await getForecastProductDetail(productId, parsedQuery.data.batchId);
    const comparisonDetail = await withReconstructedComparisonOverlay(persistedDetail);
    const result = await withRealizedAccuracyFeedback(comparisonDetail, parsedQuery.data.batchId);

    response.status(200).json(createSuccessResponse("Forecast product loaded.", result));
  } catch (error) {
    next(error);
  }
};

export const getForecastSummaryController: RequestHandler = async (_request, response, next) => {
  try {
    const result = await getForecastSummary();

    response.status(200).json(createSuccessResponse("Forecast summary loaded.", result));
  } catch (error) {
    next(error);
  }
};

export const getForecastGenerationSummaryController: RequestHandler = async (
  _request,
  response,
  next
) => {
  try {
    const result = await getForecastGenerationSummary();

    response.status(200).json(createSuccessResponse("Forecast generation summary loaded.", result));
  } catch (error) {
    next(error);
  }
};
