import { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { stockInBatch } from "../services/stockDomainService.js";

const APPLY = process.argv.includes("--apply");
const EXPECTED_PRODUCT_COUNT = 50;
const QA_REFERENCE = "QA_VERIFIED_50_STOCK_V1";

function fail(message: string): never {
  throw new Error(`Verified-50 stock seed aborted: ${message}`);
}

function assertLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is not configured.");

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail("DATABASE_URL is invalid.");
  }

  if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    fail(`refusing QA stock seed against non-local database host ${parsed.hostname}.`);
  }

  if (process.env.NODE_ENV === "production") {
    fail("refusing QA stock seed while NODE_ENV=production.");
  }
}

function addDays(base: Date, days: number) {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function expiryDaysForProduct(product: { name: string; category: { name: string } }) {
  const text = `${product.name} ${product.category.name}`.toLocaleLowerCase("en-US");

  if (/bread|loaf|mamon|hopia/.test(text)) return 14;
  if (/tocino/.test(text)) return 120;
  if (/tuna|sardine|mackerel|corned beef/.test(text)) return 730;
  if (/cheese|creamer|milk/.test(text)) return 365;
  if (/water|pocari|tea|100 plus|beverage|drink/.test(text)) return 365;
  if (/soy sauce|bagoong|tomato sauce|spread/.test(text)) return 365;
  if (/piattos|cookies|cloud 9|snack/.test(text)) return 270;

  // Personal-care items such as cotton, pads, soap and shampoo do not get a fabricated
  // food-style expiry. Their actual lot/PAO/manufacturer date must come from the package.
  if (/cotton|pads|soap|shampoo|personal care|hygiene/.test(text)) return null;

  return 365;
}

function quantityForSku(sku: string) {
  const match = sku.match(/(\d+)$/);
  const numeric = match ? Number(match[1]) : 0;
  return 12 + (numeric % 18);
}

function qaUnitCost(product: { costPrice: Prisma.Decimal | null; sellingPrice: Prisma.Decimal }) {
  if (product.costPrice && product.costPrice.gt(0)) return product.costPrice;
  return product.sellingPrice.mul("0.70").toDecimalPlaces(2);
}

function expiryForProduct(
  product: { name: string; category: { name: string } },
  baseDate: Date
) {
  const days = expiryDaysForProduct(product);
  return days === null ? null : addDays(baseDate, days);
}

assertLocalDatabase();

const now = new Date();
const baseDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));

try {
  const products = await prisma.product.findMany({
    include: {
      category: true,
      inventory: true,
      inventoryBatches: true
    },
    orderBy: [{ sku: "asc" }, { id: "asc" }],
    where: {
      barcode: { not: null },
      dataQualityStatus: "APPROVED",
      sku: { startsWith: "SARIMA-" }
    }
  });

  if (products.length !== EXPECTED_PRODUCT_COUNT) {
    fail(`expected exactly ${EXPECTED_PRODUCT_COUNT} verified products, found ${products.length}.`);
  }

  const existingSeedMovements = await prisma.inventoryMovement.count({
    where: { referenceId: QA_REFERENCE }
  });
  if (existingSeedMovements > 0) {
    fail(
      `QA seed reference ${QA_REFERENCE} already exists on ${existingSeedMovements} movement(s). This seed is intentionally one-time.`
    );
  }

  const dirtyProducts = products.filter(
    (product) =>
      (product.inventory?.quantityOnHand ?? 0) !== 0 || product.inventoryBatches.length !== 0
  );
  if (dirtyProducts.length > 0) {
    fail(
      `${dirtyProducts.length} verified product(s) already have stock/batches. Seed requires a zero-stock baseline.`
    );
  }

  const plan = products.map((product) => {
    const quantity = quantityForSku(product.sku);
    const expiresAt = expiryForProduct(product, baseDate);
    const batchCode = `QA50-${product.sku}-${baseDate.toISOString().slice(0, 10).replaceAll("-", "")}`;

    return {
      product,
      batchCode,
      quantity,
      expiresAt,
      unitCost: qaUnitCost(product)
    };
  });

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — verified-50 batch stock seed`);
  console.log(`Products:                    ${plan.length}`);
  console.log(`Products with expiry:        ${plan.filter((row) => row.expiresAt).length}`);
  console.log(`Products without expiry:     ${plan.filter((row) => !row.expiresAt).length}`);
  console.log(`Total units to receive:      ${plan.reduce((sum, row) => sum + row.quantity, 0)}`);
  console.log(`Reference:                   ${QA_REFERENCE}`);

  console.table(
    plan.map(({ product, batchCode, quantity, expiresAt, unitCost }) => ({
      sku: product.sku,
      name: product.name,
      status: product.status,
      quantity,
      batchCode,
      expiresAt: expiresAt?.toISOString().slice(0, 10) ?? "NO EXPIRY",
      unitCost: unitCost.toFixed(2)
    }))
  );

  if (!APPLY) {
    console.log("\nDry run passed. No stock rows were changed.");
    console.log(
      "Run `node --env-file=.env --import tsx backend/src/scripts/seedVerified50QaStock.ts --apply` to create the QA batches and movements."
    );
  } else {
    await prisma.$transaction(
      async (tx) => {
        for (const row of plan) {
          await stockInBatch(tx, {
            productId: row.product.id,
            quantity: row.quantity,
            unitCost: row.unitCost,
            expiresAt: row.expiresAt,
            batchCode: row.batchCode,
            reason: "Verified-50 local QA stock seed.",
            referenceId: QA_REFERENCE,
            referenceType: "QA_STOCK_SEED"
          });
        }
      },
      { maxWait: 10_000, timeout: 120_000 }
    );

    const [batchCount, movementCount, aggregateStock] = await Promise.all([
      prisma.inventoryBatch.count({ where: { batchCode: { startsWith: "QA50-" } } }),
      prisma.inventoryMovement.count({ where: { referenceId: QA_REFERENCE } }),
      prisma.inventory.aggregate({ _sum: { quantityOnHand: true } })
    ]);

    if (batchCount !== EXPECTED_PRODUCT_COUNT || movementCount !== EXPECTED_PRODUCT_COUNT) {
      fail(
        `post-seed verification failed: batches=${batchCount}, movements=${movementCount}, expected ${EXPECTED_PRODUCT_COUNT} each.`
      );
    }

    console.log(
      `\nVerified-50 stock seed complete. Created ${batchCount} batches and ${movementCount} stock-in movements.`
    );
    console.log(`Current aggregate physical stock: ${aggregateStock._sum.quantityOnHand ?? 0}`);
  }
} finally {
  await prisma.$disconnect();
}
