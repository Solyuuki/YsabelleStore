import { prisma } from "../database/prismaClient.js";
import {
  PRODUCTION_CATALOG_50_EXPECTED_COUNT,
  PRODUCTION_CATALOG_50_TARGETS
} from "../modules/catalog/catalog-production-ready-50-manifest.js";

const APPLY = process.argv.includes("--apply");

function fail(message: string): never {
  throw new Error(`Verified-50 inventory bootstrap aborted: ${message}`);
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
    fail(`refusing local QA bootstrap against non-local database host ${parsed.hostname}.`);
  }

  if (process.env.NODE_ENV === "production") {
    fail("refusing local QA bootstrap while NODE_ENV=production.");
  }
}

assertLocalDatabase();

try {
  const targetSkus = PRODUCTION_CATALOG_50_TARGETS.map(
    (target) => `SARIMA-${target.sourceProductId}`
  );

  if (targetSkus.length !== PRODUCTION_CATALOG_50_EXPECTED_COUNT) {
    fail(
      `manifest expected ${PRODUCTION_CATALOG_50_EXPECTED_COUNT} targets, found ${targetSkus.length}.`
    );
  }

  const products = await prisma.product.findMany({
    where: { sku: { in: targetSkus } },
    select: {
      id: true,
      sku: true,
      inventory: { select: { id: true, quantityOnHand: true } },
      inventoryBatches: { select: { id: true }, take: 1 },
      sarimaSourceMapping: { select: { sourceProductId: true } }
    },
    orderBy: { sku: "asc" }
  });

  if (products.length !== PRODUCTION_CATALOG_50_EXPECTED_COUNT) {
    const found = new Set(products.map((product) => product.sku));
    const missing = targetSkus.filter((sku) => !found.has(sku));
    fail(
      `expected ${PRODUCTION_CATALOG_50_EXPECTED_COUNT} target products, found ${products.length}; missing: ${missing.join(", ")}`
    );
  }

  const mismatched = products.filter((product) => {
    const expectedSourceId = product.sku.replace(/^SARIMA-/, "");
    return product.sarimaSourceMapping?.sourceProductId !== expectedSourceId;
  });

  if (mismatched.length > 0) {
    fail(`SARIMA mapping mismatch for: ${mismatched.map((product) => product.sku).join(", ")}`);
  }

  const dirty = products.filter(
    (product) =>
      (product.inventory?.quantityOnHand ?? 0) !== 0 || product.inventoryBatches.length > 0
  );

  if (dirty.length > 0) {
    fail(
      `${dirty.length} target product(s) already have stock or batches; fresh verified-50 bootstrap requires zero-stock targets.`
    );
  }

  const missingInventory = products.filter((product) => !product.inventory);

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — verified-50 zero-stock inventory bootstrap`);
  console.log(`Target products:             ${products.length}`);
  console.log(`Inventory already present:   ${products.length - missingInventory.length}`);
  console.log(`Inventory rows to create:    ${missingInventory.length}`);
  console.log("Required quantity on hand:   0");

  if (!APPLY) {
    console.log("\nDry run passed. No inventory rows were changed.");
  } else {
    await prisma.$transaction(
      async (tx) => {
        for (const product of missingInventory) {
          await tx.inventory.create({
            data: {
              productId: product.id,
              quantityOnHand: 0,
              version: 0
            }
          });
        }
      },
      { maxWait: 10_000, timeout: 120_000 }
    );

    const finalInventoryCount = await prisma.inventory.count({
      where: { productId: { in: products.map((product) => product.id) } }
    });

    if (finalInventoryCount !== PRODUCTION_CATALOG_50_EXPECTED_COUNT) {
      fail(
        `post-bootstrap inventory count is ${finalInventoryCount}, expected ${PRODUCTION_CATALOG_50_EXPECTED_COUNT}.`
      );
    }

    console.log(
      `\nVerified-50 zero-stock inventory bootstrap complete. Inventory rows present: ${finalInventoryCount}.`
    );
  }
} finally {
  await prisma.$disconnect();
}
