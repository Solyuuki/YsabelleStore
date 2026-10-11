import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type { CustomerCartItemInput } from "../validators/customerCart.validators.js";
import { getStorefrontProduct } from "./storefrontService.js";

export type CustomerCartEntry = {
  productId: string;
  quantity: number;
};

export async function listCustomerCart(customerAccountId: string): Promise<CustomerCartEntry[]> {
  const items = await prisma.customerCartItem.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { productId: true, quantity: true },
    where: { customerAccountId }
  });

  return items;
}

export async function setCustomerCartItem(
  customerAccountId: string,
  productId: string,
  requestedQuantity: number
): Promise<CustomerCartEntry[]> {
  const product = await getStorefrontProduct(productId);
  if (product.availableStock <= 0) {
    throw new HttpError(409, "This product is currently out of stock.", {
      code: "STOREFRONT_PRODUCT_OUT_OF_STOCK",
      details: { productId }
    });
  }

  const quantity = Math.min(requestedQuantity, product.availableStock, 999);
  await prisma.customerCartItem.upsert({
    create: { customerAccountId, productId, quantity },
    update: { quantity },
    where: { customerAccountId_productId: { customerAccountId, productId } }
  });

  return listCustomerCart(customerAccountId);
}

export async function mergeCustomerCart(
  customerAccountId: string,
  inputItems: CustomerCartItemInput[]
): Promise<CustomerCartEntry[]> {
  const quantities = new Map<string, number>();
  for (const item of inputItems) {
    quantities.set(
      item.productId,
      Math.min((quantities.get(item.productId) ?? 0) + item.quantity, 999)
    );
  }

  const validated = await Promise.all(
    [...quantities].map(async ([productId, quantity]) => {
      let product;
      try {
        product = await getStorefrontProduct(productId);
      } catch (error) {
        if (error instanceof HttpError && error.statusCode === 404) return null;
        throw error;
      }
      if (product.availableStock <= 0) return null;
      return {
        productId,
        quantity: Math.min(quantity, product.availableStock, 999),
        availableStock: product.availableStock
      };
    })
  );
  const mergeable = validated.filter(
    (item): item is NonNullable<(typeof validated)[number]> => item !== null
  );

  await prisma.$transaction(async (tx) => {
    const existing = await tx.customerCartItem.findMany({
      select: { productId: true, quantity: true },
      where: {
        customerAccountId,
        productId: { in: mergeable.map((item) => item.productId) }
      }
    });
    const existingByProduct = new Map(existing.map((item) => [item.productId, item.quantity]));

    for (const item of mergeable) {
      const quantity = Math.min(
        (existingByProduct.get(item.productId) ?? 0) + item.quantity,
        item.availableStock,
        999
      );
      await tx.customerCartItem.upsert({
        create: { customerAccountId, productId: item.productId, quantity },
        update: { quantity },
        where: {
          customerAccountId_productId: {
            customerAccountId,
            productId: item.productId
          }
        }
      });
    }
  });

  return listCustomerCart(customerAccountId);
}

export async function removeCustomerCartItem(
  customerAccountId: string,
  productId: string
): Promise<CustomerCartEntry[]> {
  await prisma.customerCartItem.deleteMany({ where: { customerAccountId, productId } });
  return listCustomerCart(customerAccountId);
}

export async function clearCustomerCart(customerAccountId: string): Promise<void> {
  await prisma.customerCartItem.deleteMany({ where: { customerAccountId } });
}
