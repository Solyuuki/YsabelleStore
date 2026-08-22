import type { RequestHandler } from "express";

import { createProductImageCandidate } from "../modules/catalog-image/productImageService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import { productIdParamSchema } from "../validators/product.validators.js";

export const uploadProductImageController: RequestHandler = async (request, response, next) => {
  try {
    const params = parseOrThrow(productIdParamSchema, request.params, {
      message: "Product id is invalid.",
      code: "INVALID_PRODUCT_ID"
    });

    if (!request.file) {
      throw new HttpError(400, "A product image file is required.", {
        code: "PRODUCT_IMAGE_REQUIRED"
      });
    }

    const candidate = await createProductImageCandidate(params.id, request.file);

    response
      .status(201)
      .json(createSuccessResponse("Product image candidate uploaded successfully.", candidate));
  } catch (error) {
    next(error);
  }
};
