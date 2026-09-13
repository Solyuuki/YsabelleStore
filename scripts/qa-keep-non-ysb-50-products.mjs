import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const EXPECTED_KEEP_COUNT = 50;
const INTERNAL_PREFIX = "YSB-";
const VERIFIED_SKU_PREFIX = "SARIMA-";

function fail(message) {
  throw new Error(`Verified-50 QA cleanup aborted: ${message}`);
}

function assertLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is not configured.");

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail("DATABASE_URL is invalid.");
  }

  if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    fail(`refusing destructive cleanup against non-local database host ${parsed.hostname}.`);
  }

  if (process.env.NODE_ENV === "production") {
    fail("refusing destructive cleanup while NODE_ENV=production.");
  }
}

function isExternalBarcode(barcode) {
  return Boolean(barcode) && !barcode.startsWith(INTERNAL_PREFIX);
}

function isKeepProduct(product) {
  return (
    product.sku.startsWith(VERIFIED_SKU_PREFIX) &&
    product.dataQualityStatus === "APPROVED" &&
    isExternalBarcode(product.barcode)
  );
}

async function loadPlan() {
  const products = await prisma.product.findMany({
    orderBy: [{ sku: "asc" }, { id: "asc" }],
    select: {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      status: true,
      dataQualityStatus: true,
      recordSource: true,
      inventory: { select: { quantityOnHand: true } },
      _count: {
        select: {
          saleItems: true,
          customerOrderItems: true,
          historicalMonthlySales: true,
          historicalSalesImportRows: true,
          inventoryBatches: true,
          inventoryMovements: true
        }
      }
    }
  });

  const keep = products.filter(isKeepProduct);
  const remove = products.filter((product) => !isKeepProduct(product));
  const internal = remove.filter((product) => product.barcode?.startsWith(INTERNAL_PREFIX));
  const rejectedSarimaExternal = remove.filter(
    (product) =>
      product.sku.startsWith(VERIFIED_SKU_PREFIX) &&
      isExternalBarcode(product.barcode) &&
      product.dataQualityStatus !== "APPROVED"
  );
  const legacyExternal = remove.filter(
    (product) => !product.sku.startsWith(VERIFIED_SKU_PREFIX) && isExternalBarcode(product.barcode)
  );
  const missingBarcode = remove.filter((product) => !product.barcode);

  return {
    products,
    keep,
    remove,
    internal,
    rejectedSarimaExternal,
    legacyExternal,
    missingBarcode
  };
}

function printPlan(plan) {
  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — exact verified-50 local QA catalog cleanup`);
  console.log(`Products before:             ${plan.products.length}`);
  console.log(`Approved SARIMA to keep:     ${plan.keep.length}`);
  console.log(`YSB internal products:       ${plan.internal.length}`);
  console.log(`Rejected SARIMA external:    ${plan.rejectedSarimaExternal.length}`);
  console.log(`Legacy/non-SARIMA external:  ${plan.legacyExternal.length}`);
  console.log(`Products with no barcode:    ${plan.missingBarcode.length}`);
  console.log(`Products to delete:          ${plan.remove.length}`);
  console.log(`Required survivors:          ${EXPECTED_KEEP_COUNT}`);

  console.log("\nVerified products that would remain:");
  console.table(
    plan.keep.map((product) => ({
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      quality: product.dataQualityStatus,
      status: product.status,
      stock: product.inventory?.quantityOnHand ?? 0
    }))
  );
}

async function assertPlan(plan) {
  if (plan.keep.length !== EXPECTED_KEEP_COUNT) {
    fail(
      `expected exactly ${EXPECTED_KEEP_COUNT} APPROVED SARIMA products with external barcodes, found ${plan.keep.length}. No rows were changed.`
    );
  }

  if (plan.remove.length === 0) {
    if (plan.products.length !== EXPECTED_KEEP_COUNT) {
      fail(`no cleanup candidates found but total product count is ${plan.products.length}.`);
    }
    return;
  }

  const removeIds = plan.remove.map((product) => product.id);
  const [saleItems, orderItems] = await Promise.all([
    prisma.saleItem.count({ where: { productId: { in: removeIds } } }),
    prisma.customerOrderItem.count({ where: { productId: { in: removeIds } } })
  ]);

  if (saleItems > 0 || orderItems > 0) {
    fail(
      `cleanup products still participate in ${saleItems} sale item(s) and ${orderItems} customer order item(s). Transactional history is intentionally not auto-deleted; clean/quarantine those fixtures first.`
    );
  }
}

async function applyPlan(plan) {
  const removeIds = plan.remove.map((product) => product.id);
  if (removeIds.length === 0) return;

  await prisma.$transaction(
    async (tx) => {
      await tx.productDuplicateCandidate.deleteMany({
        where: {
          OR: [{ leftProductId: { in: removeIds } }, { rightProductId: { in: removeIds } }]
        }
      });

      await tx.productCanonicalMapping.deleteMany({
        where: {
          OR: [{ sourceProductId: { in: removeIds } }, { canonicalProductId: { in: removeIds } }]
        }
      });

      await tx.sarimaSourceProductMapping.deleteMany({
        where: { canonicalProductId: { in: removeIds } }
      });

      await tx.productAlias.deleteMany({ where: { canonicalProductId: { in: removeIds } } });
      await tx.productReview.deleteMany({ where: { productId: { in: removeIds } } });
      await tx.productBarcode.deleteMany({ where: { productId: { in: removeIds } } });
      await tx.recommendationRecord.deleteMany({ where: { productId: { in: removeIds } } });
      await tx.forecastRecord.deleteMany({ where: { productId: { in: removeIds } } });
      await tx.historicalMonthlySales.deleteMany({ where: { productId: { in: removeIds } } });
      await tx.historicalSalesImportRow.updateMany({
        data: { matchedProductId: null },
        where: { matchedProductId: { in: removeIds } }
      });
      await tx.catalogAuditLog.deleteMany({
        where: {
          OR: [
            { canonicalProductId: { in: removeIds } },
            { entityId: { in: removeIds }, entityType: "PRODUCT" }
          ]
        }
      });
      await tx.productImageAsset.deleteMany({ where: { productId: { in: removeIds } } });
      await tx.inventoryMovement.deleteMany({ where: { productId: { in: removeIds } } });
      await tx.inventoryBatch.deleteMany({ where: { productId: { in: removeIds } } });
      await tx.inventory.deleteMany({ where: { productId: { in: removeIds } } });

      const deleted = await tx.product.deleteMany({ where: { id: { in: removeIds } } });
      if (deleted.count !== removeIds.length) {
        fail(`expected to delete ${removeIds.length} products, deleted ${deleted.count}.`);
      }

      const remaining = await tx.product.findMany({
        select: {
          id: true,
          sku: true,
          barcode: true,
          dataQualityStatus: true
        },
        orderBy: [{ sku: "asc" }, { id: "asc" }]
      });

      if (remaining.length !== EXPECTED_KEEP_COUNT) {
        fail(`post-cleanup product count is ${remaining.length}, expected ${EXPECTED_KEEP_COUNT}.`);
      }

      const unexpected = remaining.find((product) => !isKeepProduct(product));
      if (unexpected) {
        fail(
          `post-cleanup survivor ${unexpected.sku} is outside the APPROVED SARIMA external-barcode cohort.`
        );
      }
    },
    { maxWait: 10_000, timeout: 120_000 }
  );
}

assertLocalDatabase();

try {
  const plan = await loadPlan();
  printPlan(plan);
  await assertPlan(plan);

  if (!APPLY) {
    console.log("\nDry run passed. No database rows were changed.");
    console.log(
      "Run `node --env-file=.env scripts/qa-keep-non-ysb-50-products.mjs --apply` to permanently keep only the exact verified 50-product QA cohort."
    );
  } else {
    await applyPlan(plan);
    console.log(
      `\nVerified-50 QA cleanup complete. Deleted ${plan.remove.length} products; exactly ${EXPECTED_KEEP_COUNT} APPROVED SARIMA products with external barcodes remain.`
    );
  }
} finally {
  await prisma.$disconnect();
}
