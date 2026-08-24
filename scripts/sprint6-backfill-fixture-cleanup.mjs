import { rm } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { identifySprint6BackfillFixture } from "./lib/sprint6-backfill-fixtures.mjs";

const prisma = new PrismaClient();
const shouldApply = process.argv.includes("--apply");
const repositoryRoot = path.resolve(".");
const storageRoot = path.resolve(
  repositoryRoot,
  process.env.CATALOG_IMAGE_STORAGE_ROOT || ".data/catalog-images"
);

try {
  const products = await prisma.product.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      activeImageAssetId: true,
      category: { select: { id: true, name: true } },
      id: true,
      name: true,
      sku: true,
      imageAssets: { select: { id: true } }
    }
  });

  const fixtures = products
    .map((product) => ({
      fixture: identifySprint6BackfillFixture({
        categoryName: product.category.name,
        name: product.name,
        sku: product.sku
      }),
      product
    }))
    .filter((entry) => entry.fixture !== null);

  if (fixtures.length === 0) {
    console.info("No leaked Sprint 6 backfill fixtures found.");
    process.exitCode = 0;
  } else {
    console.info(`${shouldApply ? "Apply" : "Dry-run"} Sprint 6 backfill fixture cleanup`);
    console.info(`Exact leaked fixtures found: ${fixtures.length}`);

    let removed = 0;
    let blocked = 0;

    for (const entry of fixtures) {
      const { product } = entry;
      const protectedCounts = await readProtectedRelationCounts(product.id);
      const blockingRelations = Object.entries(protectedCounts).filter(([, count]) => count > 0);

      if (blockingRelations.length > 0) {
        blocked += 1;
        console.warn(
          `BLOCKED ${product.name}: protected relations exist (${blockingRelations
            .map(([name, count]) => `${name}=${count}`)
            .join(", ")}).`
        );
        continue;
      }

      console.info(
        `${shouldApply ? "REMOVE" : "WOULD REMOVE"} ${product.name} (${product.id}) from ${product.category.name}`
      );

      if (!shouldApply) continue;

      const candidateIds = product.imageAssets.map(({ id }) => id);
      await prisma.$transaction(async (transaction) => {
        await transaction.product.update({
          data: { activeImageAssetId: null },
          where: { id: product.id }
        });
        await transaction.catalogAuditLog.deleteMany({
          where: { canonicalProductId: product.id }
        });
        await transaction.productDuplicateCandidate.deleteMany({
          where: {
            OR: [{ leftProductId: product.id }, { rightProductId: product.id }]
          }
        });
        await transaction.productCanonicalMapping.deleteMany({
          where: {
            OR: [{ sourceProductId: product.id }, { canonicalProductId: product.id }]
          }
        });
        await transaction.productAlias.deleteMany({
          where: { canonicalProductId: product.id }
        });
        await transaction.historicalSalesImportRow.updateMany({
          data: { matchedProductId: null },
          where: { matchedProductId: product.id }
        });
        await transaction.productImageAsset.deleteMany({
          where: { productId: product.id }
        });
        await transaction.product.delete({ where: { id: product.id } });

        const remainingCategoryProducts = await transaction.product.count({
          where: { categoryId: product.category.id }
        });
        if (remainingCategoryProducts === 0) {
          await transaction.category.delete({ where: { id: product.category.id } });
        }
      });

      for (const candidateId of candidateIds) {
        if (!/^[A-Za-z0-9_-]+$/.test(candidateId)) continue;
        await rm(path.join(storageRoot, "candidates", candidateId), {
          force: true,
          recursive: true
        }).catch(() => undefined);
      }

      removed += 1;
    }

    console.info(`Removed fixtures: ${removed}`);
    console.info(`Blocked fixtures: ${blocked}`);
    if (!shouldApply) {
      console.info(
        "Dry run only. Re-run with --apply after reviewing the exact fixture list and blocker counts."
      );
    }
  }
} finally {
  await prisma.$disconnect();
}

async function readProtectedRelationCounts(productId) {
  const [
    saleItems,
    customerOrderItems,
    inventory,
    inventoryBatches,
    inventoryMovements,
    historicalMonthlySales,
    forecastRecords,
    recommendationRecords
  ] = await Promise.all([
    prisma.saleItem.count({ where: { productId } }),
    prisma.customerOrderItem.count({ where: { productId } }),
    prisma.inventory.count({ where: { productId } }),
    prisma.inventoryBatch.count({ where: { productId } }),
    prisma.inventoryMovement.count({ where: { productId } }),
    prisma.historicalMonthlySales.count({ where: { productId } }),
    prisma.forecastRecord.count({ where: { productId } }),
    prisma.recommendationRecord.count({ where: { productId } })
  ]);

  return {
    customerOrderItems,
    forecastRecords,
    historicalMonthlySales,
    inventory,
    inventoryBatches,
    inventoryMovements,
    recommendationRecords,
    saleItems
  };
}
