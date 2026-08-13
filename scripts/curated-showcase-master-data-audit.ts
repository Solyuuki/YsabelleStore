import assert from "node:assert/strict";

import { PrismaClient } from "@prisma/client";

import {
  ABOUT_STORE_ESSENTIAL_PRODUCT_IDS,
  ABOUT_STORE_ESSENTIAL_SLOT_COUNT
} from "../frontend/src/utils/storefrontCuratedShowcase";
import {
  MASTER_DATA_REVIEW_REQUIRED_ACTION,
  MASTER_DATA_REVIEW_REQUIRED_ACTOR
} from "./lib/catalog-review-actions.mjs";

const prisma = new PrismaClient();
const shouldApply = process.argv.includes("--apply");

function isValidGtin(value: string | null) {
  if (!value || !/^\d{8,14}$/.test(value)) return false;

  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;

  const weightedTotal = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);

  return (10 - (weightedTotal % 10)) % 10 === checkDigit;
}

function masterDataReviewReasons(product: {
  aliases: Array<unknown>;
  barcode: string | null;
  brand: string | null;
  canonicalMappings: Array<unknown>;
  imageUrl: string | null;
  sizeUnit: string | null;
  sizeValue: unknown;
  sourceMapping: unknown;
  variant: string | null;
}) {
  const reasons: string[] = [];

  reasons.push(
    isValidGtin(product.barcode) ? "VALID_GTIN_WITHOUT_SOURCE_MATCH" : "INVALID_GTIN_CHECK_DIGIT"
  );
  if (!product.brand) reasons.push("MISSING_BRAND");
  if (!product.variant) reasons.push("MISSING_VARIANT_OR_FLAVOR");
  if (!product.sizeValue || !product.sizeUnit) reasons.push("MISSING_PACKAGE_SIZE");
  if (!product.imageUrl) reasons.push("MISSING_VERIFIED_IMAGE");
  if (!product.aliases.length && !product.sourceMapping && !product.canonicalMappings.length) {
    reasons.push("NO_SOURCE_OR_CANONICAL_MAPPING_EVIDENCE");
  }

  return reasons;
}

async function protectedRelationshipSnapshot() {
  const [
    customerOrderItems,
    customerOrders,
    inventory,
    inventoryBatches,
    inventoryMovements,
    saleItems,
    sales
  ] = await Promise.all([
    prisma.customerOrderItem.aggregate({ _count: { _all: true }, _sum: { quantity: true } }),
    prisma.customerOrder.count(),
    prisma.inventory.aggregate({ _count: { _all: true }, _sum: { quantityOnHand: true } }),
    prisma.inventoryBatch.aggregate({
      _count: { _all: true },
      _sum: { quantityReceived: true, quantityRemaining: true }
    }),
    prisma.inventoryMovement.aggregate({ _count: { _all: true }, _sum: { quantity: true } }),
    prisma.saleItem.aggregate({ _count: { _all: true }, _sum: { quantity: true } }),
    prisma.sale.count()
  ]);

  return JSON.parse(
    JSON.stringify({
      customerOrderItems,
      customerOrders,
      inventory,
      inventoryBatches,
      inventoryMovements,
      saleItems,
      sales
    })
  );
}

async function main() {
  try {
    const products = await prisma.product.findMany({
      include: {
        aliases: true,
        canonicalMappings: true,
        sourceMapping: true
      },
      where: { id: { in: [...ABOUT_STORE_ESSENTIAL_PRODUCT_IDS] } }
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const reviewPlan = ABOUT_STORE_ESSENTIAL_PRODUCT_IDS.map((productId) => {
      const product = productById.get(productId);
      assert(product, `Curated product ${productId} is missing from the catalog.`);

      return {
        after: {
          dataQualityStatus: "NEEDS_REVIEW" as const,
          isStorefrontVisible: false
        },
        before: {
          dataQualityStatus: product.dataQualityStatus,
          isStorefrontVisible: product.isStorefrontVisible
        },
        evidence: {
          barcode: {
            isValidGtin: isValidGtin(product.barcode),
            sourceMatch: false,
            value: product.barcode
          },
          canonicalMappings: product.canonicalMappings.length,
          identityPriority: [
            "BARCODE_OR_GTIN",
            "SKU",
            "SUPPLIER_PRODUCT_CODE",
            "BRAND_PRODUCT_VARIANT_SIZE",
            "NAME_SIMILARITY_SUPPORT_ONLY"
          ],
          product: {
            brand: product.brand,
            imageUrl: product.imageUrl,
            name: product.name,
            sizeUnit: product.sizeUnit,
            sizeValue: product.sizeValue?.toString() ?? null,
            sku: product.sku,
            variant: product.variant
          },
          sourceAliases: product.aliases.length,
          sourceMapping: product.sourceMapping ? 1 : 0
        },
        product,
        reasons: masterDataReviewReasons(product)
      };
    });

    assert.equal(reviewPlan.length, ABOUT_STORE_ESSENTIAL_SLOT_COUNT);
    assert(reviewPlan.every(({ reasons }) => reasons.length > 0));

    console.info(`${shouldApply ? "Apply" : "Dry-run"} curated showcase master-data review`);
    reviewPlan.forEach(({ product, reasons }) => {
      console.info(`- ${product.id} | ${product.sku} | ${reasons.join(", ")}`);
    });

    if (!shouldApply) {
      console.info("Dry run only. Re-run with --apply to mark these records NEEDS_REVIEW.");
    } else {
      const beforeSnapshot = await protectedRelationshipSnapshot();
      const changedPlans = reviewPlan.filter(
        ({ before, after }) =>
          before.dataQualityStatus !== after.dataQualityStatus ||
          before.isStorefrontVisible !== after.isStorefrontVisible
      );

      await prisma.$transaction(async (transaction) => {
        for (const { after, evidence, product, reasons } of changedPlans) {
          await transaction.product.update({ data: after, where: { id: product.id } });
          await transaction.catalogAuditLog.create({
            data: {
              action: MASTER_DATA_REVIEW_REQUIRED_ACTION,
              actor: MASTER_DATA_REVIEW_REQUIRED_ACTOR,
              automated: true,
              canonicalProductId: product.id,
              entityId: product.id,
              entityType: "PRODUCT",
              evidence: {
                ...evidence,
                after,
                before: {
                  dataQualityStatus: product.dataQualityStatus,
                  isStorefrontVisible: product.isStorefrontVisible,
                  recordSource: product.recordSource
                },
                reviewReasons: reasons
              },
              reason:
                "Exact sellable identity cannot be proven from the catalog, source, or GTIN evidence; manual master-data review is required before storefront visibility."
            }
          });
        }
      });

      const afterSnapshot = await protectedRelationshipSnapshot();
      assert.deepEqual(
        afterSnapshot,
        beforeSnapshot,
        "Master-data review changed protected relationships."
      );
      console.info(`Applied master-data review to ${changedPlans.length} curated products.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
