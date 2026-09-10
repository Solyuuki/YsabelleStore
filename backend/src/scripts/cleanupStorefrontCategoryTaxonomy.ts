import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  executeStorefrontCategoryTaxonomyCleanup,
  type StorefrontTaxonomyCleanupClient
} from "../modules/catalog/storefront-category-taxonomy-cleanup.js";
import { prisma } from "../database/prismaClient.js";

const APPLY_FLAG = "--apply-storefront-taxonomy-cleanup";

export async function runStorefrontCategoryTaxonomyCleanup(options: {
  client?: StorefrontTaxonomyCleanupClient;
  apply: boolean;
}) {
  if (!options.apply) {
    throw new Error(
      `STOREFRONT_TAXONOMY_CLEANUP_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG} only after explicit approval.`
    );
  }

  return executeStorefrontCategoryTaxonomyCleanup({
    client: options.client ?? (prisma as unknown as StorefrontTaxonomyCleanupClient)
  });
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return (
    Boolean(entryPoint) &&
    path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url))
  );
}

if (isDirectExecution()) {
  try {
    const result = await runStorefrontCategoryTaxonomyCleanup({
      apply: process.argv.includes(APPLY_FLAG)
    });
    console.log(JSON.stringify(result.summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
