import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type { ProductAvailabilityStatusRequest } from "../validators/product.validators.js";
import { serializeProduct, type ProductSummary } from "./catalogSerializers.js";
import { getSellableStockQuantity } from "./stockDomainService.js";

const productInclude = {
  category: true,
  inventory: true,
  inventoryBatches: true,
  duplicateCandidatesLeft: { select: { status: true } },
  duplicateCandidatesRight: { select: { status: true } }
} as const;

export async function changeProductAvailability(
  productId: string,
  input: ProductAvailabilityStatusRequest
): Promise<ProductSummary> {
  const existingProduct = await prisma.product.findUnique({
    include: productInclude,
    where: { id: productId }
  });

  if (!existingProduct) {
    throw new HttpError(404, "Product not found.", {
      code: "PRODUCT_NOT_FOUND"
    });
  }

  if (existingProduct.status === "DISCONTINUED") {
    throw new HttpError(409, "Discontinued products cannot use the availability action.", {
      code: "INVALID_PRODUCT_STATUS_TRANSITION",
      details: {
        currentStatus: existingProduct.status,
        productId: existingProduct.id,
        requestedStatus: input.status
      }
    });
  }

  if (input.status === "ACTIVE") {
    if (existingProduct.dataQualityStatus !== "APPROVED") {
      throw new HttpError(422, "Only approved products can be enabled for sale.", {
        code: "PRODUCT_QUALITY_APPROVAL_REQUIRED",
        details: {
          dataQualityStatus: existingProduct.dataQualityStatus,
          productId: existingProduct.id
        }
      });
    }

    if (!existingProduct.barcode?.trim()) {
      throw new HttpError(422, "A verified barcode is required before a product can be enabled.", {
        code: "PRODUCT_BARCODE_APPROVAL_REQUIRED",
        details: { productId: existingProduct.id }
      });
    }

    const sellableStock = getSellableStockQuantity(existingProduct.inventoryBatches);
    if (sellableStock <= 0) {
      throw new HttpError(422, "Add sellable stock before setting this product to Available.", {
        code: "PRODUCT_STOCK_REQUIRED",
        details: {
          productId: existingProduct.id,
          physicalStock: existingProduct.inventory?.quantityOnHand ?? 0,
          sellableStock
        }
      });
    }
  }

  if (existingProduct.status === input.status) {
    throw new HttpError(409, "The product status changed elsewhere. Refresh and try again.", {
      code: "INVALID_PRODUCT_STATUS_TRANSITION",
      details: {
        currentStatus: existingProduct.status,
        productId: existingProduct.id,
        requestedStatus: input.status
      }
    });
  }

  const updateResult = await prisma.product.updateMany({
    data: {
      status: input.status
    },
    where: {
      id: existingProduct.id,
      status: existingProduct.status
    }
  });

  if (updateResult.count !== 1) {
    throw new HttpError(409, "The product status changed elsewhere. Refresh and try again.", {
      code: "INVALID_PRODUCT_STATUS_TRANSITION",
      details: {
        currentStatus: existingProduct.status,
        productId: existingProduct.id,
        requestedStatus: input.status
      }
    });
  }

  const updatedProduct = await prisma.product.findUnique({
    include: productInclude,
    where: { id: existingProduct.id }
  });

  if (!updatedProduct) {
    throw new HttpError(404, "Product not found.", {
      code: "PRODUCT_NOT_FOUND"
    });
  }

  return serializeProduct(updatedProduct);
}
