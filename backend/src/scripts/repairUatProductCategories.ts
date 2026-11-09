import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../database/prismaClient.js";
import { STOREFRONT_CATEGORY_TAXONOMY } from "../modules/catalog/storefront-category-taxonomy.js";
import { proposedUatCategoryCorrection } from "../modules/catalog/uat-category-repair.js";

// D01: preview by default; production data must never be changed implicitly.
const APPLY_FLAG = "--apply-uat-d01-category-repair";

export async function runUatCategoryRepair(apply = false) {
  const products = await prisma.product.findMany({
    where: {
      isStorefrontVisible: true,
      category: { is: { slug: { in: ["baking-dessert", "frozen-chilled"] } } }
    },
    select: {
      id: true,
      name: true,
      sku: true,
      category: { select: { slug: true } },
      sarimaSourceMapping: { select: { sourceProductId: true } }
    }
  });

  const candidates = products.flatMap((product) => {
    const targetCategorySlug = proposedUatCategoryCorrection({
      currentCategorySlug: product.category.slug,
      productName: product.name,
      sourceProductId: product.sarimaSourceMapping?.sourceProductId
    });
    return targetCategorySlug
      ? [{
          productId: product.id,
          sku: product.sku,
          name: product.name,
          from: product.category.slug,
          to: targetCategorySlug
        }]
      : [];
  });

  if (!apply || candidates.length === 0) {
    return { applied: false, inspected: products.length, candidates };
  }

  await prisma.$transaction(async (tx) => {
    const targetCategories = new Map<string, string>();
    for (const targetSlug of new Set(candidates.map((candidate) => candidate.to))) {
      const taxonomy = STOREFRONT_CATEGORY_TAXONOMY.find((row) => row.slug === targetSlug);
      if (!taxonomy) throw new Error(`UNKNOWN_D01_TARGET_CATEGORY: ${targetSlug}`);

      const category = await tx.category.upsert({
        where: { slug: taxonomy.slug },
        update: {
          isActive: true,
          isStorefrontVisible: true,
          dataQualityStatus: "APPROVED"
        },
        create: {
          name: taxonomy.name,
          slug: taxonomy.slug,
          isActive: true,
          isStorefrontVisible: true,
          dataQualityStatus: "APPROVED",
          recordSource: "CATALOG"
        }
      });
      targetCategories.set(targetSlug, category.id);
    }

    for (const candidate of candidates) {
      await tx.product.update({
        where: { id: candidate.productId },
        data: { categoryId: targetCategories.get(candidate.to)! }
      });
    }
  });

  return { applied: true, inspected: products.length, candidates };
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) &&
    path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  try {
    const result = await runUatCategoryRepair(process.argv.includes(APPLY_FLAG));
    console.log(JSON.stringify(result, null, 2));
    if (!result.applied) {
      console.log(`Dry run only. Review all candidates, then rerun with ${APPLY_FLAG} to apply.`);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
