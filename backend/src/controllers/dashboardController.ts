import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { getDashboardOperations, getDashboardSummary } from "../services/dashboardService.js";
import {
  getDashboardSalesCalendar,
  getDashboardSalesDay,
  setDashboardSalesTarget
} from "../services/dashboardSalesCalendarService.js";
import { getNavigationBadges } from "../services/navigationBadgeService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import {
  dashboardSalesCalendarQuerySchema,
  dashboardSalesDayQuerySchema,
  dashboardSalesTargetBodySchema,
  dashboardSalesTargetParamsSchema
} from "../validators/dashboard.validators.js";

export const getDashboardSummaryController: RequestHandler = async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request);

    if (!user) {
      throw new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      });
    }

    const summary = await getDashboardSummary(user.role);

    response
      .status(200)
      .json(createSuccessResponse("Dashboard summary loaded successfully.", summary));
  } catch (error) {
    next(error);
  }
};

export const getDashboardOperationsController: RequestHandler = async (
  _request,
  response,
  next
) => {
  try {
    const operations = await getDashboardOperations();

    response
      .status(200)
      .json(createSuccessResponse("Dashboard operations loaded successfully.", operations));
  } catch (error) {
    next(error);
  }
};

export const getNavigationBadgesController: RequestHandler = async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request);

    if (!user) {
      throw new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      });
    }

    const badges = await getNavigationBadges(user.role);

    response
      .status(200)
      .json(createSuccessResponse("Navigation badges loaded successfully.", badges));
  } catch (error) {
    next(error);
  }
};


export const getDashboardSalesCalendarController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const parsed = dashboardSalesCalendarQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new HttpError(400, "Sales calendar query is invalid.", {
        code: "INVALID_SALES_CALENDAR_QUERY",
        details: parsed.error.flatten()
      });
    }

    const user = getAuthenticatedUser(request);
    if (!user) {
      throw new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      });
    }

    const calendar = await getDashboardSalesCalendar(parsed.data.month, user.role);
    response
      .status(200)
      .json(createSuccessResponse("Sales calendar loaded successfully.", calendar));
  } catch (error) {
    next(error);
  }
};

export const getDashboardSalesDayController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const parsed = dashboardSalesDayQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new HttpError(400, "Sales day query is invalid.", {
        code: "INVALID_SALES_DAY_QUERY",
        details: parsed.error.flatten()
      });
    }

    const day = await getDashboardSalesDay(parsed.data.date);
    response.status(200).json(createSuccessResponse("Sales day loaded successfully.", day));
  } catch (error) {
    next(error);
  }
};

export const setDashboardSalesTargetController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const user = getAuthenticatedUser(request);
    if (!user) {
      throw new HttpError(401, "Authentication token is required.", {
        code: "AUTH_TOKEN_REQUIRED"
      });
    }

    const parsedParams = dashboardSalesTargetParamsSchema.safeParse(request.params);
    const parsedBody = dashboardSalesTargetBodySchema.safeParse(request.body);
    if (!parsedParams.success || !parsedBody.success) {
      throw new HttpError(400, "Sales target request is invalid.", {
        code: "INVALID_SALES_TARGET",
        details: {
          body: parsedBody.success ? null : parsedBody.error.flatten(),
          params: parsedParams.success ? null : parsedParams.error.flatten()
        }
      });
    }

    const target = await setDashboardSalesTarget(
      parsedParams.data.date,
      parsedBody.data.targetAmount,
      user.id
    );
    response.status(200).json(createSuccessResponse("Sales target saved successfully.", target));
  } catch (error) {
    next(error);
  }
};
