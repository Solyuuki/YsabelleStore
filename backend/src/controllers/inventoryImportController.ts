import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import {
  getInventoryStockImportTemplateCsv,
  importInventoryStockFromFile,
  previewInventoryStockImport
} from "../services/inventoryImportService.js";

type RequestWithFile = Parameters<RequestHandler>[0] & {
  file?: Express.Multer.File;
};

function getUploadedFile(request: RequestWithFile) {
  if (!request.file) {
    throw new HttpError(400, "A CSV or Excel file is required.", {
      code: "INVENTORY_STOCK_IMPORT_FILE_REQUIRED"
    });
  }

  return {
    originalname: request.file.originalname,
    mimetype: request.file.mimetype,
    buffer: request.file.buffer
  };
}

export const getInventoryStockImportTemplateController: RequestHandler = (_request, response) => {
  response
    .status(200)
    .setHeader("Content-Type", "text/csv; charset=utf-8")
    .setHeader("Content-Disposition", 'attachment; filename="inventory-stock-import-template.csv"')
    .send(getInventoryStockImportTemplateCsv());
};

export const previewInventoryStockImportController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const file = getUploadedFile(request as RequestWithFile);
    const result = await previewInventoryStockImport(file);

    response
      .status(200)
      .json(
        createSuccessResponse("Inventory stock import preview generated successfully.", result)
      );
  } catch (error) {
    next(error);
  }
};

export const confirmInventoryStockImportController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const file = getUploadedFile(request as RequestWithFile);
    const actor = getAuthenticatedUser(request);
    const result = await importInventoryStockFromFile(file, actor?.id);

    response
      .status(201)
      .json(createSuccessResponse("Inventory stock import completed successfully.", result));
  } catch (error) {
    next(error);
  }
};
