import type { PrismaClient } from "@prisma/client";

type BaselineIds = {
  categories: string[];
  customerOrders: string[];
  products: string[];
  sales: string[];
  users: string[];
};

export type DatabaseFixtureScope = {
  cleanup(): Promise<void>;
};

export async function captureDatabaseFixtureScope(
  prisma: PrismaClient
): Promise<DatabaseFixtureScope> {
  const [categories, customerOrders, products, sales, users] = await Promise.all([
    prisma.category.findMany({ select: { id: true } }),
    prisma.customerOrder.findMany({ select: { id: true } }),
    prisma.product.findMany({ select: { id: true } }),
    prisma.sale.findMany({ select: { id: true } }),
    prisma.user.findMany({ select: { id: true } })
  ]);
  const baseline: BaselineIds = {
    categories: categories.map(({ id }) => id),
    customerOrders: customerOrders.map(({ id }) => id),
    products: products.map(({ id }) => id),
    sales: sales.map(({ id }) => id),
    users: users.map(({ id }) => id)
  };

  return {
    async cleanup() {
      const [newCategories, newCustomerOrders, newProducts, newSales, newUsers] = await Promise.all(
        [
          findNewIds(prisma.category, baseline.categories),
          findNewIds(prisma.customerOrder, baseline.customerOrders),
          findNewIds(prisma.product, baseline.products),
          findNewIds(prisma.sale, baseline.sales),
          findNewIds(prisma.user, baseline.users)
        ]
      );

      await prisma.$transaction(async (transaction) => {
        if (newCustomerOrders.length > 0) {
          await transaction.customerOrder.deleteMany({ where: { id: { in: newCustomerOrders } } });
        }

        if (newSales.length > 0) {
          await transaction.sale.deleteMany({ where: { id: { in: newSales } } });
        }

        if (newProducts.length > 0) {
          const productIds = { in: newProducts };
          await transaction.customerOrderItem.deleteMany({ where: { productId: productIds } });
          await transaction.saleItem.deleteMany({ where: { productId: productIds } });
          await transaction.recommendationRecord.deleteMany({ where: { productId: productIds } });
          await transaction.forecastRecord.deleteMany({ where: { productId: productIds } });
          await transaction.historicalMonthlySales.deleteMany({ where: { productId: productIds } });
          await transaction.historicalSalesImportRow.updateMany({
            data: { matchedProductId: null },
            where: { matchedProductId: productIds }
          });
          await transaction.inventoryMovement.deleteMany({ where: { productId: productIds } });
          await transaction.inventoryBatch.deleteMany({ where: { productId: productIds } });
          await transaction.inventory.deleteMany({ where: { productId: productIds } });
          await transaction.product.deleteMany({ where: { id: productIds } });
        }

        if (newCategories.length > 0) {
          await transaction.category.deleteMany({ where: { id: { in: newCategories } } });
        }

        if (newUsers.length > 0) {
          await transaction.user.deleteMany({ where: { id: { in: newUsers } } });
        }
      });
    }
  };
}

type IdDelegate = {
  findMany(args: {
    select: { id: true };
    where?: { id: { notIn: string[] } };
  }): Promise<Array<{ id: string }>>;
};

async function findNewIds(delegate: IdDelegate, baselineIds: string[]) {
  const rows = await delegate.findMany({
    select: { id: true },
    where: baselineIds.length > 0 ? { id: { notIn: baselineIds } } : undefined
  });
  return rows.map(({ id }) => id);
}
