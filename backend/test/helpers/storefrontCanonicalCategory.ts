import type { Category } from "@prisma/client";

import { prisma } from "../../src/database/prismaClient.js";
import { STOREFRONT_CATEGORY_TAXONOMY } from "../../src/modules/catalog/storefront-category-taxonomy.js";

export type CanonicalStorefrontCategoryFixture = {
  category: Category;
  created: boolean;
};

export async function ensureCanonicalStorefrontCategory(
  index = 0
): Promise<CanonicalStorefrontCategoryFixture> {
  const definition = STOREFRONT_CATEGORY_TAXONOMY[index];

  if (!definition) {
    throw new Error(`Missing storefront category definition at index ${index}.`);
  }

  const existing = await prisma.category.findUnique({
    where: { name: definition.name }
  });

  if (existing) {
    if (
      !existing.isActive ||
      !existing.isStorefrontVisible ||
      existing.dataQualityStatus !== "APPROVED" ||
      existing.recordSource === "TEST_FIXTURE"
    ) {
      throw new Error(
        `Canonical storefront category ${definition.name} exists but is not storefront-ready.`
      );
    }

    return { category: existing, created: false };
  }

  const conflictingSlug = await prisma.category.findUnique({
    where: { slug: definition.slug }
  });

  if (conflictingSlug) {
    throw new Error(
      `Canonical storefront slug ${definition.slug} is already assigned to ${conflictingSlug.name}.`
    );
  }

  const category = await prisma.category.create({
    data: {
      dataQualityStatus: "APPROVED",
      isActive: true,
      isStorefrontVisible: true,
      name: definition.name,
      recordSource: "CATALOG",
      slug: definition.slug
    }
  });

  return { category, created: true };
}
