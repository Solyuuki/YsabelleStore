import { InventoryBatchStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { getThesisDemoExpiryDate } from "../utils/thesisDemoExpiry.js";

const APPLY_FLAG = "--apply-thesis-demo-2026-10-19";
const CHUNK_SIZE = 50;

export async function backfillThesisDemoExpiries(apply = false) {
  const batches = await prisma.inventoryBatch.findMany({
    orderBy: { id: "asc" },
    select: { id: true, productId: true },
    where: {
      expiresAt: null,
      quantityRemaining: { gt: 0 },
      status: { in: [InventoryBatchStatus.AVAILABLE, InventoryBatchStatus.LOW_STOCK] }
    }
  });

  const report = {
    mode: apply ? "apply" : "dry-run",
    source: "THESIS_DEMO_NOT_MANUFACTURER_VERIFIED",
    eligibleBatches: batches.length,
    eligibleProducts: new Set(batches.map((batch) => batch.productId)).size,
    generatedDateRange: "2028-10-19..2029-10-19",
    appliedBatches: 0
  };

  if (!apply) return report;
  if (
    process.env.RAILWAY_ENVIRONMENT_NAME !== "production" ||
    process.env.RAILWAY_PROJECT_ID !== "78e2a5d3-f0f8-4e4a-a425-41bb4c6e161e"
  ) {
    throw new Error("Thesis demo expiry writes are restricted to the approved Railway project.");
  }

  for (let i = 0; i < batches.length; i += CHUNK_SIZE) {
    const chunk = batches.slice(i, i + CHUNK_SIZE);
    const updates = await prisma.$transaction(
      chunk.map((batch) =>
        prisma.inventoryBatch.updateMany({
          data: { expiresAt: getThesisDemoExpiryDate(batch.productId, batch.id) },
          where: { id: batch.id, expiresAt: null }
        })
      )
    );
    report.appliedBatches += updates.reduce((total, result) => total + result.count, 0);
  }

  return report;
}

void backfillThesisDemoExpiries(process.argv.includes(APPLY_FLAG))
  .then((result) => {
    console.log(JSON.stringify(result));
  })
  .catch((error: unknown) => {
    console.error("Thesis demo expiry backfill failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
