import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  executeTestFixtureCleanup,
  type TestFixtureCleanupClient
} from "../modules/catalog/catalog-test-fixture-cleanup.js";
import { prisma } from "../database/prismaClient.js";

const APPLY_FLAG = "--apply-approved-test-fixture-cleanup";

export async function runApprovedTestFixtureCleanup(options: {
  client?: TestFixtureCleanupClient;
  applyApprovedTestFixtureCleanup: boolean;
}) {
  if (!options.applyApprovedTestFixtureCleanup) {
    throw new Error(
      `TEST_FIXTURE_CLEANUP_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG} only after explicit approval.`
    );
  }

  const client = options.client ?? (prisma as unknown as TestFixtureCleanupClient);

  return executeTestFixtureCleanup({
    client,
    authorization: {
      expectedFixtureProducts: 2495,
      expectedCatalogAuditLogs: 2491,
      expectedInventoryMovements: 2492,
      expectedInventoryBatches: 2259,
      expectedInventories: 2495,
      expectedSaleItems: 148,
      expectedSales: 148
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
    const result = await runApprovedTestFixtureCleanup({
      applyApprovedTestFixtureCleanup: process.argv.includes(APPLY_FLAG)
    });
    console.log(JSON.stringify(result.summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
