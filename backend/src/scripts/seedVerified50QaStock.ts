import type { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { storefrontProductWhere } from "../services/catalogQualityPolicy.js";
import { getSellableStockQuantity, stockInBatch } from "../services/stockDomainService.js";

const APPLY = process.argv.includes("--apply");
const EXPECTED_PRODUCT_COUNT = 50;
const QA_REFERENCE = "QA_VERIFIED_50_STOCK_V2";
const QA_MOVEMENT_REASON = "Verified-50 baseline stock seed.";

type ShelfLifeProfile = {
  days: number | null;
  basis: string;
  assumption: string;
};

const skuGroups = {
  cannedFishMeat: new Set([
    "SARIMA-P008",
    "SARIMA-P009",
    "SARIMA-P010",
    "SARIMA-P011",
    "SARIMA-P012",
    "SARIMA-P013",
    "SARIMA-P085",
    "SARIMA-P086",
    "SARIMA-P087",
    "SARIMA-P089",
    "SARIMA-P107",
    "SARIMA-P114",
    "SARIMA-P121",
    "SARIMA-P122",
    "SARIMA-P123"
  ]),
  gardeniaBread: new Set(["SARIMA-P022", "SARIMA-P023", "SARIMA-P024"]),
  marbyPastry: new Set(["SARIMA-P027", "SARIMA-P030", "SARIMA-P031"]),
  noFabricatedExpiry: new Set([
    "SARIMA-P048",
    "SARIMA-P054",
    "SARIMA-P061",
    "SARIMA-P074",
    "SARIMA-P075"
  ]),
  processedCheese: new Set(["SARIMA-P115", "SARIMA-P141"]),
  saucesAndShelfStableDairy: new Set([
    "SARIMA-P103",
    "SARIMA-P177",
    "SARIMA-P199",
    "SARIMA-P201",
    "SARIMA-P202",
    "SARIMA-P204"
  ]),
  bottledWater: new Set(["SARIMA-P219", "SARIMA-P268", "SARIMA-P317", "SARIMA-P318"]),
  generalBeverage: new Set(["SARIMA-P257", "SARIMA-P266"]),
  packagedSnack: new Set(["SARIMA-P299", "SARIMA-P352", "SARIMA-P361"]),
  chocolate: new Set(["SARIMA-P342", "SARIMA-P343"]),
  powderedMilk: new Set(["SARIMA-P394", "SARIMA-P397"])
} as const;

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

function shelfLifeProfileForSku(sku: string): ShelfLifeProfile {
  if (skuGroups.cannedFishMeat.has(sku)) {
    return {
      days: 730,
      basis: "USDA/FSIS low-acid commercially canned foods: 2–5 years best-quality range; QA uses conservative 2-year bound.",
      assumption: "Unopened can stored cool and dry; replace with printed batch date when actual stock is received."
    };
  }

  if (skuGroups.gardeniaBread.has(sku)) {
    return {
      days: 7,
      basis: "Gardenia Philippines G-Lock uses a 7-day freshness guide for retail bread.",
      assumption: "Unopened retail loaf stored cool and dry; printed best-before remains authoritative."
    };
  }

  if (skuGroups.marbyPastry.has(sku)) {
    return {
      days: 10,
      basis: "USDA FoodKeeper pantry guidance for pastries: 5–10 days; QA uses upper bound for sealed packaged pastry.",
      assumption: "Sealed ambient packaged pastry; replace with package date when available."
    };
  }

  if (sku === "SARIMA-P038") {
    return {
      days: 60,
      basis: "FoodSafety.gov frozen processed-meat quality guidance commonly spans about 1–2 months; QA uses 60 days.",
      assumption: "Purefoods Tocino treated as continuously frozen stock for this baseline; do not reuse this date if stored chilled."
    };
  }

  if (skuGroups.noFabricatedExpiry.has(sku)) {
    return {
      days: null,
      basis: "No defensible generic printed-expiry proxy. FDA notes cosmetic shelf life is manufacturer-determined and not universally date-labeled.",
      assumption: "Use actual manufacturer/lot expiry or PAO from the package when receiving physical stock."
    };
  }

  if (skuGroups.processedCheese.has(sku)) {
    return {
      days: 180,
      basis: "Magnolia Cheezee retail case listing states 6-month shelf life; QA uses the same conservative processed-cheese profile.",
      assumption: "Unopened processed cheese under labeled storage conditions; printed best-before remains authoritative."
    };
  }

  if (skuGroups.saucesAndShelfStableDairy.has(sku)) {
    return {
      days: 365,
      basis: "Conservative one-year QA quality window for unopened shelf-stable sauce/spread/filled-milk products where exact lot dating is unavailable.",
      assumption: "Cool, dry storage; replace with package best-before/expiry for real receiving."
    };
  }

  if (skuGroups.bottledWater.has(sku)) {
    return {
      days: 365,
      basis: "One-year QA quality-rotation proxy for sealed bottled water; FDA regulates bottled-water safety but lot-specific quality dating remains manufacturer/label driven.",
      assumption: "This is an operational rotation date, not a claim that sealed water becomes unsafe after one year."
    };
  }

  if (sku === "SARIMA-P238") {
    return {
      days: 270,
      basis: "Otsuka product documentation lists a 9-month shelf life for POCARI SWEAT 900 mL PET.",
      assumption: "Unopened bottle stored according to manufacturer guidance."
    };
  }

  if (skuGroups.generalBeverage.has(sku)) {
    return {
      days: 365,
      basis: "Conservative one-year QA quality window for unopened shelf-stable bottled tea/sports beverages when exact lot dating is unavailable.",
      assumption: "Printed manufacturer best-before is authoritative for real stock."
    };
  }

  if (skuGroups.packagedSnack.has(sku)) {
    return {
      days: 270,
      basis: "Nine-month QA quality window for sealed packaged chips/cookies/crackers; intended as a conservative operational baseline.",
      assumption: "Cool, dry storage; replace with printed best-before for real receiving."
    };
  }

  if (skuGroups.chocolate.has(sku)) {
    return {
      days: 365,
      basis: "USDA FoodKeeper guidance lists unopened chocolate at about 1–2 years; QA uses conservative 1-year bound.",
      assumption: "Unopened product stored cool and dry."
    };
  }

  if (sku === "SARIMA-P386") {
    return {
      days: 365,
      basis: "USDA FoodKeeper guidance for unopened instant coffee: about 1 year in a cool, dry pantry.",
      assumption: "Unopened sticks kept dry and away from heat."
    };
  }

  if (skuGroups.powderedMilk.has(sku)) {
    return {
      days: 1095,
      basis: "USDA FoodKeeper guidance for unopened powdered milk: about 3–5 years; QA uses conservative 3-year bound.",
      assumption: "Unopened powder kept cool and dry; printed brand date is authoritative for real stock."
    };
  }

  fail(`no explicit shelf-life profile is defined for ${sku}.`);
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
    const shelfLife = shelfLifeProfileForSku(product.sku);
    const expiresAt = shelfLife.days === null ? null : addDays(baseDate, shelfLife.days);
    const batchCode = `QA50-${product.sku}-${baseDate.toISOString().slice(0, 10).replaceAll("-", "")}`;

    return {
      product,
      batchCode,
      quantity,
      expiresAt,
      shelfLife,
      unitCost: qaUnitCost(product)
    };
  });

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — verified-50 research-backed batch stock seed`);
  console.log(`Products:                    ${plan.length}`);
  console.log(`Products with expiry:        ${plan.filter((row) => row.expiresAt).length}`);
  console.log(`Products without expiry:     ${plan.filter((row) => !row.expiresAt).length}`);
  console.log(`Total units to receive:      ${plan.reduce((sum, row) => sum + row.quantity, 0)}`);
  console.log(`Reference:                   ${QA_REFERENCE}`);

  console.table(
    plan.map(({ product, batchCode, quantity, expiresAt, shelfLife, unitCost }) => ({
      sku: product.sku,
      name: product.name,
      status: product.status,
      quantity,
      batchCode,
      expiresAt: expiresAt?.toISOString().slice(0, 10) ?? "NO EXPIRY",
      shelfLifeDays: shelfLife.days ?? "PACKAGE DATE REQUIRED",
      unitCost: unitCost.toFixed(2)
    }))
  );

  if (!APPLY) {
    console.log("\nShelf-life basis by product:");
    for (const row of plan) {
      console.log(`- ${row.product.sku}: ${row.shelfLife.basis}`);
      console.log(`  Assumption: ${row.shelfLife.assumption}`);
    }
    console.log("\nDry run passed. No stock rows were changed.");
    console.log(
      "Run `node --env-file=.env --import tsx backend/src/scripts/seedVerified50QaStock.ts --apply` to create the baseline batches and movements."
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
            reason: QA_MOVEMENT_REASON,
            referenceId: QA_REFERENCE,
            referenceType: "QA_STOCK_SEED"
          });
        }
      },
      { maxWait: 10_000, timeout: 120_000 }
    );

    const [batchCount, movementCount, aggregateStock, storefrontProducts] = await Promise.all([
      prisma.inventoryBatch.count({ where: { batchCode: { startsWith: "QA50-" } } }),
      prisma.inventoryMovement.count({ where: { referenceId: QA_REFERENCE } }),
      prisma.inventory.aggregate({ _sum: { quantityOnHand: true } }),
      prisma.product.findMany({
        include: { inventoryBatches: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        where: storefrontProductWhere()
      })
    ]);

    if (batchCount !== EXPECTED_PRODUCT_COUNT || movementCount !== EXPECTED_PRODUCT_COUNT) {
      fail(
        `post-seed verification failed: batches=${batchCount}, movements=${movementCount}, expected ${EXPECTED_PRODUCT_COUNT} each.`
      );
    }

    const storefrontSellable = storefrontProducts.filter(
      (product) => getSellableStockQuantity(product.inventoryBatches) > 0
    );

    console.log(
      `\nVerified-50 stock seed complete. Created ${batchCount} batches and ${movementCount} stock-in movements.`
    );
    console.log(`Current aggregate physical stock: ${aggregateStock._sum.quantityOnHand ?? 0}`);
    console.log(`Storefront-eligible products:     ${storefrontProducts.length}`);
    console.log(`Storefront products with stock:   ${storefrontSellable.length}`);
  }
} finally {
  await prisma.$disconnect();
}
