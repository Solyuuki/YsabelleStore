import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const shouldApply = process.argv.includes("--apply");
const fixturePattern = /^Customer Order Test ([0-9a-f]{8})$/i;

try {
  const categories = await prisma.category.findMany({
    include: {
      products: {
        orderBy: { id: "asc" },
        select: { id: true, name: true, sku: true }
      }
    },
    orderBy: { name: "asc" },
    where: { name: { startsWith: "Customer Order Test " } }
  });

  const fixtures = [];
  for (const category of categories) {
    const match = category.name.match(fixturePattern);
    if (!match) continue;

    const suffix = match[1].toLowerCase();
    const expectedProductName = `Customer Order Product ${suffix}`;
    const expectedSku = `CUSTOMER-ORDER-${suffix}`;

    if (
      category.products.length !== 1 ||
      category.products[0].name.toLowerCase() !== expectedProductName.toLowerCase() ||
      category.products[0].sku.toLowerCase() !== expectedSku.toLowerCase()
    ) {
      throw new Error(`Refusing to purge mixed or malformed fixture category: ${category.name}`);
    }

    const product = category.products[0];
    const protectedCounts = await readProtectedRelationCounts(product.id);
    const blocking = Object.entries(protectedCounts).filter(([, count]) => count > 0);
    if (blocking.length > 0) {
      throw new Error(
        `Refusing to purge ${product.name}: protected relations exist (${blocking
          .map(([name, count]) => `${name}=${count}`)
          .join(", ")}).`
      );
    }

    fixtures.push({ categoryId: category.id, productId: product.id, suffix });
  }

  console.info(`${shouldApply ? "Apply" : "Dry-run"} customer-order fixture cleanup`);
  if (fixtures.length === 0) {
    console.info("No leaked Customer Order Test fixtures found.");
  }

  for (const fixture of fixtures) {
    console.info(
      `${shouldApply ? "REMOVE" : "WOULD REMOVE"} Customer Order Test ${fixture.suffix} / Customer Order Product ${fixture.suffix}`
    );
  }

  if (!shouldApply) {
    console.info("No database changes made. Re-run with --apply after reviewing the exact set.");
  } else {
    await prisma.$transaction(async (tx) => {
      for (const fixture of fixtures) {
        const customerOrders = await tx.customerOrder.findMany({
          select: { id: true, customerAccountId: true },
          where: { items: { some: { productId: fixture.productId } } }
        });
        const customerOrderIds = customerOrders.map(({ id }) => id);
        const candidateCustomerAccountIds = customerOrders
          .map(({ customerAccountId }) => customerAccountId)
          .filter((id) => id !== null);

        if (customerOrderIds.length > 0) {
          await tx.customerOrder.deleteMany({ where: { id: { in: customerOrderIds } } });
        }

        await tx.inventoryBatch.deleteMany({ where: { productId: fixture.productId } });
        await tx.inventory.deleteMany({ where: { productId: fixture.productId } });
        await tx.product.delete({ where: { id: fixture.productId } });
        await tx.category.delete({ where: { id: fixture.categoryId } });

        if (candidateCustomerAccountIds.length > 0) {
          const exactAccounts = await tx.customerAccount.findMany({
            select: { id: true },
            where: {
              id: { in: candidateCustomerAccountIds },
              OR: [
                {
                  username: { in: [`customer.a.${fixture.suffix}`, `customer.b.${fixture.suffix}`] }
                },
                {
                  email: {
                    in: [
                      `customer-a-${fixture.suffix}@example.com`,
                      `customer-b-${fixture.suffix}@example.com`
                    ]
                  }
                }
              ]
            }
          });
          const exactAccountIds = exactAccounts.map(({ id }) => id);
          if (exactAccountIds.length > 0) {
            await tx.customerSession.deleteMany({
              where: { customerAccountId: { in: exactAccountIds } }
            });
            await tx.customerAccount.deleteMany({ where: { id: { in: exactAccountIds } } });
          }
        }
      }
    });

    console.info(`Removed fixtures: ${fixtures.length}`);
  }
} finally {
  await prisma.$disconnect();
}

async function readProtectedRelationCounts(productId) {
  const [
    saleItems,
    inventoryMovements,
    historicalMonthlySales,
    forecastRecords,
    recommendationRecords,
    reviews,
    aliases,
    canonicalMappings,
    duplicateCandidates,
    sarimaMappings,
    auditLogs
  ] = await Promise.all([
    prisma.saleItem.count({ where: { productId } }),
    prisma.inventoryMovement.count({ where: { productId } }),
    prisma.historicalMonthlySales.count({ where: { productId } }),
    prisma.forecastRecord.count({ where: { productId } }),
    prisma.recommendationRecord.count({ where: { productId } }),
    prisma.productReview.count({ where: { productId } }),
    prisma.productAlias.count({ where: { canonicalProductId: productId } }),
    prisma.productCanonicalMapping.count({
      where: { OR: [{ sourceProductId: productId }, { canonicalProductId: productId }] }
    }),
    prisma.productDuplicateCandidate.count({
      where: { OR: [{ leftProductId: productId }, { rightProductId: productId }] }
    }),
    prisma.sarimaSourceProductMapping.count({ where: { canonicalProductId: productId } }),
    prisma.catalogAuditLog.count({ where: { canonicalProductId: productId } })
  ]);

  return {
    aliases,
    auditLogs,
    canonicalMappings,
    duplicateCandidates,
    forecastRecords,
    historicalMonthlySales,
    inventoryMovements,
    recommendationRecords,
    reviews,
    saleItems,
    sarimaMappings
  };
}
