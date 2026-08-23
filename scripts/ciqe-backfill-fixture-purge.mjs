import { PrismaClient } from "@prisma/client";

import {
  isMatchingCiqeBackfillFixtureProduct,
  parseCiqeBackfillFixtureCategory
} from "./lib/ciqe-backfill-fixtures.mjs";

const prisma = new PrismaClient();
const shouldApply = process.argv.includes("--apply");
const suffixArg = readValue("--suffix");

try {
  const categories = await prisma.category.findMany({
    include: { products: { orderBy: { id: "asc" } } },
    orderBy: { id: "asc" }
  });
  const plan = [];

  for (const category of categories) {
    const fixture = parseCiqeBackfillFixtureCategory(category);
    if (!fixture) continue;
    if (suffixArg && fixture.suffix !== suffixArg.toLowerCase()) continue;
    if (
      category.products.length === 0 ||
      category.products.some((product) => !isMatchingCiqeBackfillFixtureProduct(product, fixture))
    ) {
      throw new Error(`Refusing to purge mixed or malformed fixture category: ${category.name}`);
    }

    for (const product of category.products) {
      const relations = await protectedRelationCounts(product.id);
      const protectedCount = Object.values(relations).reduce((sum, count) => sum + count, 0);
      if (protectedCount > 0) {
        throw new Error(
          `Refusing to purge ${product.name}: protected domain relationships exist (${JSON.stringify(relations)}).`
        );
      }
    }

    plan.push({ category, fixture });
  }

  console.info(`${shouldApply ? "Apply" : "Dry-run"} Sprint 6 CIQE fixture purge`);
  if (plan.length === 0) {
    console.info("No exact Sprint 6 CIQE backfill fixtures found.");
  }
  for (const item of plan) {
    console.info(
      `- ${item.category.name}: ${item.category.products.map((product) => product.name).join(", ")}`
    );
  }

  if (!shouldApply) {
    console.info("No database changes made. Re-run with --apply after reviewing the exact set.");
  } else {
    await prisma.$transaction(async (tx) => {
      for (const item of plan) {
        const productIds = item.category.products.map((product) => product.id);
        await tx.productImageAsset.deleteMany({ where: { productId: { in: productIds } } });
        await tx.product.deleteMany({ where: { id: { in: productIds } } });
        await tx.category.delete({ where: { id: item.category.id } });
      }
    });
    console.info(`Purged ${plan.length} fixture categor${plan.length === 1 ? "y" : "ies"}.`);
  }
} finally {
  await prisma.$disconnect();
}

function readValue(flag) {
  const direct = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (direct) return direct.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function protectedRelationCounts(productId) {
  const [
    inventory,
    inventoryBatches,
    inventoryMovements,
    saleItems,
    customerOrderItems,
    forecastRecords,
    recommendationRecords,
    historicalMonthlySales,
    historicalSalesImportRows,
    reviews,
    aliases,
    canonicalMappings,
    duplicateCandidates,
    sarimaMappings,
    auditLogs
  ] = await Promise.all([
    prisma.inventory.count({ where: { productId } }),
    prisma.inventoryBatch.count({ where: { productId } }),
    prisma.inventoryMovement.count({ where: { productId } }),
    prisma.saleItem.count({ where: { productId } }),
    prisma.customerOrderItem.count({ where: { productId } }),
    prisma.forecastRecord.count({ where: { productId } }),
    prisma.recommendationRecord.count({ where: { productId } }),
    prisma.historicalMonthlySales.count({ where: { productId } }),
    prisma.historicalSalesImportRow.count({ where: { matchedProductId: productId } }),
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
    customerOrderItems,
    duplicateCandidates,
    forecastRecords,
    historicalMonthlySales,
    historicalSalesImportRows,
    inventory,
    inventoryBatches,
    inventoryMovements,
    recommendationRecords,
    reviews,
    saleItems,
    sarimaMappings
  };
}
