import { prisma } from "../database/prismaClient.js";

type InventoryShellBootstrapOptions = {
  productIds?: string[];
};

export type InventoryShellBootstrapResult = {
  candidates: number;
  created: number;
};

export async function ensureCatalogInventoryShells(
  options: InventoryShellBootstrapOptions = {}
): Promise<InventoryShellBootstrapResult> {
  const requestedProductIds = options.productIds?.filter(Boolean);

  return prisma.$transaction(async (transaction) => {
    const missingProducts = await transaction.product.findMany({
      where: {
        inventory: { is: null },
        recordSource: { not: "TEST_FIXTURE" },
        ...(requestedProductIds?.length
          ? {
              id: {
                in: requestedProductIds
              }
            }
          : {})
      },
      select: {
        id: true,
        sku: true,
        _count: {
          select: {
            inventoryBatches: true,
            inventoryMovements: true
          }
        }
      }
    });

    const unsafeProducts = missingProducts.filter(
      (product) => product._count.inventoryBatches > 0 || product._count.inventoryMovements > 0
    );

    if (unsafeProducts.length > 0) {
      const details = unsafeProducts
        .map(
          (product) =>
            `${product.sku} (${product.id}): ${product._count.inventoryBatches} batches, ${product._count.inventoryMovements} movements`
        )
        .join("; ");

      throw new Error(
        `Inventory shell backfill requires manual review because stock evidence already exists: ${details}`
      );
    }

    if (missingProducts.length === 0) {
      return {
        candidates: 0,
        created: 0
      };
    }

    const result = await transaction.inventory.createMany({
      data: missingProducts.map((product) => ({
        productId: product.id,
        quantityOnHand: 0,
        version: 0
      })),
      skipDuplicates: true
    });

    return {
      candidates: missingProducts.length,
      created: result.count
    };
  });
}
