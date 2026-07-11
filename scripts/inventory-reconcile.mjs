import { existsSync, readFileSync } from "node:fs";

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

function parseArgs(argv) {
  const flags = new Set(argv);

  if (flags.has("--apply") && flags.has("--dry-run")) {
    throw new Error("Use either --apply or --dry-run, not both.");
  }

  return {
    apply: flags.has("--apply"),
    dryRun: !flags.has("--apply") || flags.has("--dry-run")
  };
}

function describeDatabase(url) {
  try {
    const parsed = new URL(url);

    return {
      database: parsed.pathname.replace(/^\/+/, "") || "(unknown)",
      host: parsed.host || "(unknown)",
      protocol: parsed.protocol.replace(/:$/, "")
    };
  } catch {
    return {
      database: "(unparseable)",
      host: "(unparseable)",
      protocol: "(unparseable)"
    };
  }
}

function getBatchTotal(product) {
  return product.inventoryBatches.reduce((total, batch) => total + batch.quantityRemaining, 0);
}

function classifyMismatch(inventoryQuantity, batchTotal, batchCount) {
  if (inventoryQuantity < 0 || batchTotal < 0) {
    return "E";
  }

  if (!Number.isInteger(inventoryQuantity) || !Number.isInteger(batchTotal)) {
    return "E";
  }

  if (!batchCount && inventoryQuantity > 0) {
    return "C";
  }

  if (batchCount === 0 && inventoryQuantity === 0) {
    return "NONE";
  }

  if (inventoryQuantity > batchTotal) {
    return "A";
  }

  if (batchTotal > inventoryQuantity) {
    return "B";
  }

  return "NONE";
}

function recommendedRepair(classification) {
  switch (classification) {
    case "A":
      return "Add one reconciliation batch and one adjustment-in movement.";
    case "B":
      return "Synchronize inventory to batch total and create a correction movement.";
    case "C":
      return "Create one opening reconciliation batch and one movement.";
    case "D":
      return "Create the missing inventory row and align it to batch total.";
    case "E":
      return "Manual review required before any automatic repair.";
    default:
      return "No repair needed.";
  }
}

function formatMovementType(classification) {
  if (classification === "A" || classification === "C") {
    return "ADJUSTMENT_IN";
  }

  if (classification === "B") {
    return "ADJUSTMENT_OUT";
  }

  return "N/A";
}

loadRootEnv();

const { PrismaClient } = await import("@prisma/client");
const { prisma: stockPrisma } = await import("../backend/src/database/prismaClient.js");
const { auditStock, buildReconciliationIdentifiers, reconcileLegacyStockMismatch } =
  await import("../backend/src/services/stockDomainService.js");
const { searchPosProducts } = await import("../backend/src/services/posService.js");

const { apply, dryRun } = parseArgs(process.argv.slice(2));

if (apply && process.env.NODE_ENV === "production") {
  console.error("Refusing to run inventory reconciliation in production.");
  process.exitCode = 1;
} else if (apply && !process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for inventory reconciliation.");
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();
  const databaseInfo = process.env.DATABASE_URL
    ? describeDatabase(process.env.DATABASE_URL)
    : { database: "(missing)", host: "(missing)", protocol: "(missing)" };

  try {
    const inventoryRows = await prisma.inventory.findMany({
      include: {
        product: {
          include: {
            category: true,
            inventoryBatches: {
              orderBy: [
                {
                  createdAt: "asc"
                },
                {
                  id: "asc"
                }
              ]
            },
            inventoryMovements: {
              orderBy: [
                {
                  createdAt: "asc"
                },
                {
                  id: "asc"
                }
              ]
            }
          }
        }
      },
      orderBy: {
        productId: "asc"
      }
    });

    const mismatchRows = inventoryRows
      .map((inventory) => {
        const batchTotal = getBatchTotal(inventory.product);
        const difference = inventory.quantityOnHand - batchTotal;
        const classification = classifyMismatch(
          inventory.quantityOnHand,
          batchTotal,
          inventory.product.inventoryBatches.length
        );

        return {
          batchCodes: inventory.product.inventoryBatches.map((batch) => batch.batchCode),
          batchCount: inventory.product.inventoryBatches.length,
          batchTotal,
          classification,
          difference,
          expiryDates: inventory.product.inventoryBatches.map((batch) =>
            batch.expiresAt ? batch.expiresAt.toISOString().slice(0, 10) : null
          ),
          inventory,
          movementCount: inventory.product.inventoryMovements.length,
          movementHistory: inventory.product.inventoryMovements.map((movement) => ({
            quantity: movement.quantity,
            quantityAfter: movement.quantityAfter,
            quantityBefore: movement.quantityBefore,
            referenceId: movement.referenceId,
            referenceType: movement.referenceType,
            type: movement.type
          })),
          productName: inventory.product.name,
          repairPlan: recommendedRepair(classification),
          seedOrigin: inventory.productId.startsWith("prd_")
        };
      })
      .filter((row) => row.classification !== "NONE");

    console.log("YsabelleStore Inventory Reconciliation");
    console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
    console.log(
      `Database: ${databaseInfo.protocol}://${databaseInfo.host}/${databaseInfo.database}`
    );
    console.log("");

    console.table(
      mismatchRows.map((row) => ({
        batchCount: row.batchCount,
        batchTotal: row.batchTotal,
        classification: row.classification,
        difference: row.difference,
        inventory: row.inventory.quantityOnHand,
        productId: row.inventory.productId,
        productName: row.productName,
        repairPlan: row.repairPlan,
        sku: row.inventory.product.sku,
        seedOrigin: row.seedOrigin
      }))
    );

    if (!apply) {
      for (const row of mismatchRows) {
        const identifiers = buildReconciliationIdentifiers(row.inventory.product.sku);
        console.log("");
        console.log(`Product: ${row.productName} (${row.inventory.product.sku})`);
        console.log(`Classification: ${row.classification}`);
        console.log(
          `Movement history: ${row.movementHistory.map((entry) => entry.type).join(", ") || "(none)"}`
        );
        console.log(`Batch codes: ${row.batchCodes.join(", ") || "(none)"}`);
        console.log(`Expiry dates: ${row.expiryDates.join(", ") || "(none)"}`);
        console.log(`Planned batch: ${identifiers.batchCode}`);
        console.log(`Planned movement reference: ${identifiers.referenceId}`);
        console.log(`Planned movement type: ${formatMovementType(row.classification)}`);
        console.log(`Planned repair: ${row.repairPlan}`);
      }

      console.log(
        `\nDry run complete. ${mismatchRows.length} product${mismatchRows.length === 1 ? "" : "s"} require repair.`
      );
      process.exit(0);
    }

    const actor =
      (await prisma.user.findFirst({
        orderBy: [
          {
            role: "asc"
          },
          {
            createdAt: "asc"
          }
        ],
        where: {
          status: "ACTIVE"
        }
      })) ?? null;

    const outcomes = [];

    for (const row of mismatchRows) {
      if (row.classification === "E") {
        outcomes.push({
          classification: row.classification,
          productId: row.inventory.productId,
          result: "blocked",
          reason: "Invalid quantity requires manual review."
        });
        continue;
      }

      if (row.classification !== "A" && row.classification !== "C" && row.classification !== "B") {
        outcomes.push({
          classification: row.classification,
          productId: row.inventory.productId,
          result: "skipped",
          reason: "No automatic repair path was selected."
        });
        continue;
      }

      try {
        const result = await prisma.$transaction(async (tx) =>
          reconcileLegacyStockMismatch(tx, {
            performedById: actor?.id ?? null,
            productId: row.inventory.productId,
            quantity: row.difference > 0 ? row.difference : 0,
            reason: "Reconciled legacy inventory and batch stock mismatch.",
            repairDate: new Date(),
            sku: row.inventory.product.sku
          })
        );

        outcomes.push({
          classification: row.classification,
          createdBatch: result.createdBatch,
          createdMovement: result.createdMovement,
          movementId: result.movement?.id ?? null,
          productId: row.inventory.productId,
          result: "repaired",
          sku: row.inventory.product.sku
        });
      } catch (error) {
        outcomes.push({
          classification: row.classification,
          error: error instanceof Error ? error.message : String(error),
          productId: row.inventory.productId,
          result: "failed",
          sku: row.inventory.product.sku
        });
      }
    }

    const postAudit = await auditStock(prisma);
    const unresolved = postAudit.filter((row) => row.invariantStatus === "MISMATCH");

    console.log("\nApplied reconciliation outcomes:");
    console.table(outcomes);

    console.log("\nPost-apply audit:");
    console.table(postAudit);

    const verifiedPos = [];
    for (const row of mismatchRows.filter(
      (entry) => entry.classification === "A" || entry.classification === "C"
    )) {
      const search = await searchPosProducts(row.inventory.product.sku, { page: 1, pageSize: 20 });
      verifiedPos.push({
        availableStock:
          search.products.find((product) => product.id === row.inventory.productId)
            ?.availableStock ?? null,
        found: search.products.some((product) => product.id === row.inventory.productId),
        productId: row.inventory.productId,
        sku: row.inventory.product.sku
      });
    }

    console.log("\nPOS verification:");
    console.table(verifiedPos);

    if (unresolved.length === 0) {
      console.log("\nReconciliation finished with zero unexplained mismatches.");
      process.exitCode = 0;
    } else {
      console.error(`\nReconciliation left ${unresolved.length} mismatch(es) unresolved.`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await stockPrisma.$disconnect();
  }
}
