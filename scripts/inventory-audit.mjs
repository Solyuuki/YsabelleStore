import { existsSync, readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

function loadRootEnv() {
  if (!existsSync(".env")) {
    return;
  }

  const lines = readFileSync(".env", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");

    if (key && !process.env[key]) {
      process.env[key] = valueParts.join("=");
    }
  }
}

loadRootEnv();

const prisma = new PrismaClient();

try {
  const inventoryRows = await prisma.inventory.findMany({
    include: {
      product: {
        include: {
          inventoryBatches: true
        }
      }
    },
    orderBy: {
      productId: "asc"
    }
  });

  const rows = inventoryRows.map((inventory) => {
    const batchTotal = inventory.product.inventoryBatches.reduce(
      (total, batch) => total + batch.quantityRemaining,
      0
    );
    const difference = inventory.quantityOnHand - batchTotal;

    return {
      productId: inventory.productId,
      sku: inventory.product.sku,
      quantityOnHand: inventory.quantityOnHand,
      batchTotal,
      difference,
      invariantStatus: difference === 0 ? "OK" : "MISMATCH"
    };
  });

  console.log("YsabelleStore Stock Audit\n");
  console.table(rows);

  const mismatchCount = rows.filter((row) => row.invariantStatus === "MISMATCH").length;

  if (mismatchCount > 0) {
    console.error(
      `\nStock audit detected ${mismatchCount} mismatch${mismatchCount === 1 ? "" : "es"}.`
    );
    process.exitCode = 1;
  } else {
    console.log("\nStock audit completed with no mismatches.");
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
