import { CatalogQualityStatus, CatalogRecordSource, ProductStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { STOREFRONT_CATEGORY_TAXONOMY } from "../modules/catalog/storefront-category-taxonomy.js";
import { desiredRetailCategorySlug } from "../modules/catalog/uatRetailCategoryClassifier.js";

const apply = process.argv.includes("--apply-uat-d01");

async function main() {
  const [categories, products, sourceMappings] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true, name: true } }),
    prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        categoryId: true,
        status: true,
        isStorefrontVisible: true,
        category: { select: { slug: true } }
      }
    }),
    prisma.sarimaSourceProductMapping.findMany({
      select: { canonicalProductId: true, sourceCategory: true }
    })
  ]);

  const sourceByProductId = new Map(
    sourceMappings.map((row) => [row.canonicalProductId, row.sourceCategory])
  );
  const publicSlugs = new Set<string>(STOREFRONT_CATEGORY_TAXONOMY.map((row) => row.slug));
  const currentBySlug = new Map(categories.map((row) => [row.slug, row]));
  const selected = [];
  const unresolved = [];

  for (const product of products) {
    if (product.status === ProductStatus.DISCONTINUED) continue;
    const sourceCategory = sourceByProductId.get(product.id);
    const expected = desiredRetailCategorySlug({
      sku: product.sku,
      name: product.name,
      currentSlug: product.category.slug,
      sourceCategory
    });
    if (!expected || !publicSlugs.has(expected)) {
      if (product.isStorefrontVisible) unresolved.push(product.sku);
      continue;
    }
    selected.push({ id: product.id, sku: product.sku, currentId: product.categoryId, targetSlug: expected });
  }

  const collisions = STOREFRONT_CATEGORY_TAXONOMY.filter((entry) =>
    categories.some((existing) => existing.name === entry.name && existing.slug !== entry.slug)
  ).map((entry) => entry.name);

  console.info(JSON.stringify({
    fix: "UAT-D01",
    mode: apply ? "APPLY" : "DRY_RUN",
    checkedProducts: products.length,
    classifiedProducts: selected.length,
    unresolvedStorefrontSkus: unresolved,
    conflictingCategoryNames: collisions,
    possibleReassignments: selected.filter((item) => currentBySlug.get(item.targetSlug)?.id !== item.currentId).length
  }));

  if (unresolved.length || collisions.length) {
    throw new Error("UAT_D01_REVIEW_REQUIRED: ambiguous visible products or category name collisions");
  }
  if (!apply) return;

  // No inventory counts, prices, SKUs, transactions or order records are updated.
  const result = await prisma.$transaction(async (tx) => {
    const categoryIds = new Map<string, string>();
    for (const entry of STOREFRONT_CATEGORY_TAXONOMY) {
      const category = await tx.category.upsert({
        where: { slug: entry.slug },
        create: {
          name: entry.name,
          slug: entry.slug,
          description: "Retail product category",
          recordSource: CatalogRecordSource.CATALOG,
          dataQualityStatus: CatalogQualityStatus.APPROVED,
          isActive: true,
          isStorefrontVisible: true
        },
        update: { name: entry.name }
      });
      categoryIds.set(entry.slug, category.id);
    }
    let changed = 0;
    for (const item of selected) {
      const targetId = categoryIds.get(item.targetSlug)!;
      if (targetId === item.currentId) continue;
      await tx.product.update({ where: { id: item.id }, data: { categoryId: targetId } });
      changed += 1;
    }
    return { changed, categorized: selected.length };
  }, { timeout: 120000, maxWait: 20000 });
  console.info("UAT_D01_RETAIL_CATEGORIES_APPLIED", JSON.stringify(result));
}

void main()
  .catch((error) => {
    console.error("UAT_D01_RETAIL_CATEGORIES_ABORTED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
