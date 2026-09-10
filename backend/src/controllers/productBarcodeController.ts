import type { RequestHandler } from "express";
import { ProductBarcodeSource } from "@prisma/client";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import {
  enrollReceivingBarcode,
  listProductBarcodes,
  registerProductBarcode,
  setPrimaryProductBarcode
} from "../services/productBarcodeService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import {
  productBarcodeIdParamSchema,
  productBarcodeProductIdParamSchema,
  receivingBarcodeEnrollmentSchema,
  registerProductBarcodeSchema
} from "../validators/productBarcode.validators.js";

export const listProductBarcodesController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(productBarcodeProductIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });
    const records = await listProductBarcodes(params.productId);
    response.status(200).json(createSuccessResponse("Product barcodes loaded successfully.", records));
  } catch (error) {
    next(error);
  }
};

export const registerProductBarcodeController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(productBarcodeProductIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });
    const body = parseOrThrow(registerProductBarcodeSchema, request.body, {
      message: "Product barcode request is invalid.",
      code: "INVALID_PRODUCT_BARCODE_REQUEST"
    });
    const actor = getAuthenticatedUser(request);
    const result = await registerProductBarcode({
      productId: params.productId,
      barcode: body.barcode,
      source: ProductBarcodeSource.MANUAL,
      registeredById: actor?.id,
      sourceReference: "catalog-product-barcode-api",
      makePrimary: body.makePrimary
    });

    response
      .status(result.created ? 201 : 200)
      .json(
        createSuccessResponse(
          result.created ? "Product barcode registered successfully." : "Product barcode already registered.",
          result
        )
      );
  } catch (error) {
    next(error);
  }
};

export const setPrimaryProductBarcodeController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(productBarcodeIdParamSchema, request.params, {
      message: "Product barcode id is invalid.",
      code: "INVALID_PRODUCT_BARCODE_ID"
    });
    const actor = getAuthenticatedUser(request);
    const record = await setPrimaryProductBarcode({
      productId: params.productId,
      barcodeId: params.barcodeId,
      actorId: actor?.id
    });
    response
      .status(200)
      .json(createSuccessResponse("Primary product barcode updated successfully.", record));
  } catch (error) {
    next(error);
  }
};

export const enrollReceivingBarcodeController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(productBarcodeProductIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });
    const body = parseOrThrow(receivingBarcodeEnrollmentSchema, request.body, {
      message: "Receiving barcode request is invalid.",
      code: "INVALID_RECEIVING_BARCODE_REQUEST"
    });
    const actor = getAuthenticatedUser(request);
    const result = await enrollReceivingBarcode({
      productId: params.productId,
      barcode: body.barcode,
      confirmed: body.confirmed,
      registeredById: actor?.id,
      sourceReference: body.sourceReference ?? "inventory-receiving"
    });

    response
      .status(result.created ? 201 : 200)
      .json(
        createSuccessResponse(
          result.created ? "Receiving barcode registered successfully." : "Barcode is already registered to this product.",
          result
        )
      );
  } catch (error) {
    next(error);
  }
};
