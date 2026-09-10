import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  executeKnownNonProductionCatalogCleanup,
  type KnownNonProductionCleanupClient
} from "../modules/catalog/catalog-known-non-production-cleanup.js";
import { DEVELOPMENT_CATALOG_SEED_IDENTITIES } from "../modules/catalog/development-catalog-seed-identities.js";
import { LEGACY_RUNTIME_QA_IDENTITIES } from "../modules/catalog/legacy-runtime-qa-identities.js";
import { prisma } from "../database/prismaClient.js";

const APPLY_FLAG = "--apply-approved-known-non-production-cleanup";

export async function runApprovedKnownNonProductionCatalogCleanup(options: {
  client?: KnownNonProductionCleanupClient;
  applyApprovedKnownNonProductionCleanup: boolean;
}) {
  if (!options.applyApprovedKnownNonProductionCleanup) {
    throw new Error(
      `KNOWN_NON_PRODUCTION_CLEANUP_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG} only after explicit approval.`
    );
  }

  const client = options.client ?? (prisma as unknown as KnownNonProductionCleanupClient);

  return executeKnownNonProductionCatalogCleanup({
    client,
    authorization: {
      developmentSeeds: DEVELOPMENT_CATALOG_SEED_IDENTITIES,
      legacyRuntimeQa: LEGACY_RUNTIME_QA_IDENTITIES,
      expectedProductDuplicateCandidates: 1,
      expectedProductAliases: 1,
      expectedCatalogAuditLogs: 14,
      expectedInventoryMovements: 27,
      expectedDevelopmentSeedMovements: 24,
      expectedLegacySaleMovements: 3,
      expectedInventoryBatches: 9,
      expectedInventories: 11,
      expectedSaleItems: 3,
      expectedSales: 3
    }
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
    const result = await runApprovedKnownNonProductionCatalogCleanup({
      applyApprovedKnownNonProductionCleanup: process.argv.includes(APPLY_FLAG)
    });
    console.log(JSON.stringify(result.summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
