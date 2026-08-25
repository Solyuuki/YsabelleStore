import type { RequestHandler } from "express";
import { z } from "zod";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { generateForecastBatch } from "../modules/forecasting/forecast.service.js";
import { prisma } from "../database/prismaClient.js";
import {
  confirmHistoricalSalesImport,
  getHistoricalSalesBatch,
  getHistoricalSalesEligibilitySummary,
  getHistoricalSalesTemplateCsv,
  HISTORICAL_SALES_IMPORT_MODES,
  listHistoricalSalesBatches,
  listHistoricalSalesBatchRows,
  previewHistoricalSalesImport,
  previewHistoricalSalesRollback,
  rollbackHistoricalSalesBatch
} from "../services/historicalSalesImportService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";

type RequestWithFile = Parameters<RequestHandler>[0] & { file?: Express.Multer.File };

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
const confirmSchema = z.object({
  importMode: z.enum(HISTORICAL_SALES_IMPORT_MODES),
  previewBatchId: z.string().min(1).max(191)
});
const rollbackSchema = z.object({ reason: z.string().trim().min(5).max(500) });
const rowQuerySchema = paginationSchema.extend({
  status: z
    .enum([
      "VALID",
      "WARNING",
      "INVALID",
      "UNMATCHED",
      "DUPLICATE",
      "OVERLAP",
      "IMPORTED",
      "SKIPPED",
      "REPLACED"
    ])
    .optional()
});

function uploadedFile(request: RequestWithFile) {
  if (!request.file) {
    throw new HttpError(400, "A CSV or XLSX historical sales file is required.", {
      code: "HISTORICAL_SALES_FILE_REQUIRED"
    });
  }
  return {
    buffer: request.file.buffer,
    mimetype: request.file.mimetype,
    originalname: request.file.originalname
  };
}

function actorId(request: Parameters<RequestHandler>[0]) {
  const user = getAuthenticatedUser(request);
  if (!user)
    throw new HttpError(401, "Authentication is required.", { code: "AUTH_TOKEN_REQUIRED" });
  return user.id;
}

function parsedPagination(query: unknown) {
  const parsed = paginationSchema.safeParse(query);
  if (!parsed.success)
    throw new HttpError(400, "Pagination is invalid.", {
      code: "INVALID_PAGINATION",
      details: parsed.error.flatten()
    });
  return parsed.data;
}

export const historicalSalesTemplateController: RequestHandler = (_request, response) => {
  response
    .status(200)
    .setHeader("Content-Type", "text/csv; charset=utf-8")
    .setHeader("Content-Disposition", 'attachment; filename="historical-sales-import-template.csv"')
    .send(getHistoricalSalesTemplateCsv());
};

export const previewHistoricalSalesController: RequestHandler = async (request, response, next) => {
  try {
    const data = await previewHistoricalSalesImport(
      uploadedFile(request as RequestWithFile),
      actorId(request)
    );
    response.status(201).json(createSuccessResponse("Historical sales preview is ready.", data));
  } catch (error) {
    next(error);
  }
};

export const confirmHistoricalSalesController: RequestHandler = async (request, response, next) => {
  try {
    const parsed = confirmSchema.safeParse(request.body);
    if (!parsed.success)
      throw new HttpError(400, "Historical sales confirmation is invalid.", {
        code: "INVALID_HISTORICAL_SALES_CONFIRMATION",
        details: parsed.error.flatten()
      });
    const data = await confirmHistoricalSalesImport(
      uploadedFile(request as RequestWithFile),
      parsed.data.previewBatchId,
      parsed.data.importMode,
      actorId(request)
    );
    response.status(201).json(createSuccessResponse("Historical sales import completed.", data));
  } catch (error) {
    next(error);
  }
};

export const listHistoricalSalesBatchesController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const { page, pageSize } = parsedPagination(request.query);
    response
      .status(200)
      .json(
        createSuccessResponse(
          "Historical sales import history loaded.",
          await listHistoricalSalesBatches(page, pageSize)
        )
      );
  } catch (error) {
    next(error);
  }
};

export const getHistoricalSalesBatchController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    response
      .status(200)
      .json(
        createSuccessResponse(
          "Historical sales batch loaded.",
          await getHistoricalSalesBatch(request.params.batchId ?? "")
        )
      );
  } catch (error) {
    next(error);
  }
};

export const listHistoricalSalesRowsController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const parsed = rowQuerySchema.safeParse(request.query);
    if (!parsed.success)
      throw new HttpError(400, "Historical sales row filters are invalid.", {
        code: "INVALID_HISTORICAL_SALES_ROW_QUERY",
        details: parsed.error.flatten()
      });
    const { page, pageSize, status } = parsed.data;
    response
      .status(200)
      .json(
        createSuccessResponse(
          "Historical sales row audit loaded.",
          await listHistoricalSalesBatchRows(request.params.batchId ?? "", page, pageSize, status)
        )
      );
  } catch (error) {
    next(error);
  }
};

export const previewHistoricalSalesRollbackController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    response
      .status(200)
      .json(
        createSuccessResponse(
          "Historical sales rollback impact loaded.",
          await previewHistoricalSalesRollback(request.params.batchId ?? "")
        )
      );
  } catch (error) {
    next(error);
  }
};

export const rollbackHistoricalSalesController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const parsed = rollbackSchema.safeParse(request.body);
    if (!parsed.success)
      throw new HttpError(400, "A valid rollback reason is required.", {
        code: "INVALID_HISTORICAL_SALES_ROLLBACK",
        details: parsed.error.flatten()
      });
    const data = await rollbackHistoricalSalesBatch(
      request.params.batchId ?? "",
      actorId(request),
      parsed.data.reason
    );
    response.status(200).json(createSuccessResponse("Historical sales batch rolled back.", data));
  } catch (error) {
    next(error);
  }
};

export const historicalSalesEligibilityController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const { page, pageSize } = parsedPagination(request.query);
    response
      .status(200)
      .json(
        createSuccessResponse(
          "SARIMA eligibility loaded.",
          await getHistoricalSalesEligibilitySummary(page, pageSize)
        )
      );
  } catch (error) {
    next(error);
  }
};

export const refreshHistoricalSalesForecastsController: RequestHandler = async (
  request,
  response,
  next
) => {
  const batchId = request.params.batchId ?? "";
  try {
    const batch = await getHistoricalSalesBatch(batchId);
    const metadata =
      batch.metadata && typeof batch.metadata === "object" && !Array.isArray(batch.metadata)
        ? (batch.metadata as Record<string, unknown>)
        : {};
    const productIds = Array.isArray(metadata.affectedProductIds)
      ? metadata.affectedProductIds.filter((id): id is string => typeof id === "string")
      : [];
    if (!productIds.length)
      throw new HttpError(409, "This batch has no affected products to refresh.", {
        code: "NO_AFFECTED_FORECAST_PRODUCTS"
      });
    const result = await generateForecastBatch({ force: true, productIds });
    await prisma.historicalSalesImportBatch.update({
      data: { forecastRefreshStatus: "SUCCEEDED", errorMessage: null },
      where: { id: batchId }
    });
    response
      .status(200)
      .json(createSuccessResponse("Affected forecasts refreshed.", result.generation));
  } catch (error) {
    await prisma.historicalSalesImportBatch.updateMany({
      data: {
        forecastRefreshStatus: "FAILED",
        errorMessage:
          error instanceof Error ? error.message.slice(0, 500) : "Forecast refresh failed."
      },
      where: { id: batchId }
    });
    next(error);
  }
};
