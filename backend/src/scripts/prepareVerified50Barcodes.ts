import { prisma } from "../database/prismaClient.js";
import {
  PRODUCTION_CATALOG_50_EXPECTED_COUNT,
  PRODUCTION_CATALOG_50_TARGETS
} from "../modules/catalog/catalog-production-ready-50-manifest.js";
import { buildYsabelleInternalBarcode } from "../utils/catalogBarcode.js";

function fail(message: string): never {
  throw new Error(`Verified-50 barcode preparation aborted: ${message}`);
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
    fail(`refusing local QA barcode preparation against non-local database host ${parsed.hostname}.`);
  }

  if (process.env.NODE_ENV === "production") {
    fail("refusing local QA barcode preparation while NODE_ENV=production.");
  }
}

assertLocalDatabase();

try {
  const targetBySku = new Map(
    PRODUCTION_CATALOG_50_TARGETS.map((target) => [
      `SARIMA-${target.sourceProductId}`,
      target
    ])
  );

  if (targetBySku.size !== PRODUCTION_CATALOG_50_EXPECTED_COUNT) {
    fail(
      `manifest expected ${PRODUCTION_CATALOG_50_EXPECTED_COUNT} unique targets, found ${targetBySku.size}.`
    );
  }

  const products = await prisma.product.findMany({
    where: { sku: { in: [...targetBySku.keys()] } },
    select: {
      id: true,
      sku: true,
      barcode: true,
      sarimaSourceMapping: { select: { sourceProductId: true } }
    },
    orderBy: { sku: "asc" }
  });

  if (products.length !== PRODUCTION_CATALOG_50_EXPECTED_COUNT) {
    const found = new Set(products.map((product) => product.sku));
    const missing = [...targetBySku.keys()].filter((sku) => !found.has(sku));
    fail(
      `expected ${PRODUCTION_CATALOG_50_EXPECTED_COUNT} target products, found ${products.length}; missing: ${missing.join(", ")}`
    );
  }

  const plan = products.map((product) => {
    const target = targetBySku.get(product.sku);
    if (!target) fail(`unexpected target SKU ${product.sku}.`);

    if (product.sarimaSourceMapping?.sourceProductId !== target.sourceProductId) {
      fail(
        `${product.sku} SARIMA mapping mismatch; expected ${target.sourceProductId}, found ${product.sarimaSourceMapping?.sourceProductId ?? "NULL"}.`
      );
    }

    const internalBarcode = buildYsabelleInternalBarcode({
      id: product.id,
      sku: product.sku
    });

    if (
      product.barcode !== null &&
      product.barcode !== internalBarcode &&
      product.barcode !== target.manufacturerBarcode
    ) {
      fail(
        `${product.sku} has unexpected barcode ${product.barcode}; expected NULL, ${internalBarcode}, or ${target.manufacturerBarcode}.`
      );
    }

    return {
      ...product,
      target,
      internalBarcode,
      needsWrite: product.barcode === null
    };
  });

  const candidates = plan.filter((row) => row.needsWrite);
  console.log("\nAPPLY - verified-50 barcode preparation");
  console.log(`Target products:             ${plan.length}`);
  console.log(`Already acceptable:          ${plan.length - candidates.length}`);
  console.log(`Internal barcodes to assign: ${candidates.length}`);

  await prisma.$transaction(
    async (tx) => {
      for (const row of candidates) {
        const collision = await tx.product.findFirst({
          where: {
            barcode: row.internalBarcode,
            id: { not: row.id }
          },
          select: { id: true, sku: true }
        });

        if (collision) {
          fail(
            `${row.internalBarcode} collides with ${collision.sku} (${collision.id}).`
          );
        }

        const updated = await tx.product.updateMany({
          where: {
            id: row.id,
            sku: row.sku,
            barcode: null
          },
          data: {
            barcode: row.internalBarcode
          }
        });

        if (updated.count !== 1) {
          fail(`${row.sku} barcode preparation affected ${updated.count} rows.`);
        }

        await tx.catalogAuditLog.create({
          data: {
            entityType: "PRODUCT",
            entityId: row.id,
            canonicalProductId: row.id,
            action: "VERIFIED_50_INTERNAL_BARCODE_PREPARED",
            reason:
              "Assigned the deterministic YsabelleStore internal barcode required before reviewed verified-50 manufacturer barcode approval.",
            automated: true,
            actor: "verified-50-bootstrap",
            evidence: {
              sku: row.sku,
              sourceProductId: row.target.sourceProductId,
              internalBarcode: row.internalBarcode,
              targetManufacturerBarcode: row.target.manufacturerBarcode
            }
          }
        });
      }
    },
    { maxWait: 10_000, timeout: 120_000 }
  );

  const remainingInvalid = await prisma.product.count({
    where: {
      sku: { in: [...targetBySku.keys()] },
      barcode: null
    }
  });

  if (remainingInvalid !== 0) {
    fail(`post-preparation verification found ${remainingInvalid} target product(s) with NULL barcode.`);
  }

  console.log(
    `Verified-50 barcode preparation complete. Assigned ${candidates.length} deterministic internal barcode(s).`
  );
} finally {
  await prisma.$disconnect();
}
