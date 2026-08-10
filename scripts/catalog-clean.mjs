import assert from "node:assert/strict";

import { PrismaClient } from "@prisma/client";

import {
  CANONICAL_CATEGORY_UPDATES,
  extractCanonicalSize,
  fixtureCategoryEvidence,
  fixtureProductEvidence,
  hasLifecycleDescriptionConflict,
  isValidCustomerName,
  normalizeCanonicalProductName,
  normalizeCatalogIdentity
} from "./lib/catalog-quality.mjs";

const prisma = new PrismaClient();
const shouldApply = process.argv.includes("--apply");

try {
  const plan = await buildCleaningPlan();
  printPlan(plan);

  if (!shouldApply) {
    console.info("Dry run only. Re-run through catalog:clean:apply to commit this exact policy.");
  } else {
    const before = await relationshipSnapshot(prisma);
    const result = await applyCleaningPlan(plan, before);
    const after = await relationshipSnapshot(prisma);
    assert.deepEqual(after, before, "Catalog cleaning changed protected relationship totals.");
    console.info(
      `Catalog cleaning committed: ${result.productsReclassified} products reclassified, ${result.categoriesReclassified} categories reclassified, ${result.productNamesNormalized} product names normalized, ${result.categoriesRenamed} categories renamed, and ${result.duplicateCandidatesCreated} duplicate candidate created.`
    );
    console.info(
      "Protected sales, inventory, history, forecasting, and order totals are unchanged."
    );
  }
} finally {
  await prisma.$disconnect();
}

async function buildCleaningPlan() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        barcode: true,
        brand: true,
        category: { select: { id: true, isActive: true, name: true, slug: true } },
        dataQualityStatus: true,
        description: true,
        id: true,
        imageUrl: true,
        isStorefrontVisible: true,
        name: true,
        recordSource: true,
        sellingPrice: true,
        sizeUnit: true,
        sizeValue: true,
        sku: true,
        status: true,
        unit: true,
        variant: true
      }
    }),
    prisma.category.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        dataQualityStatus: true,
        id: true,
        isActive: true,
        isStorefrontVisible: true,
        name: true,
        recordSource: true,
        slug: true
      }
    })
  ]);
  const fixtureProductIds = new Set(
    products.filter((product) => fixtureProductEvidence(product).length > 0).map(({ id }) => id)
  );
  const businessProducts = products.filter(({ id }) => !fixtureProductIds.has(id));
  const duplicateGroups = [
    ...groupBy(businessProducts, (product) => normalizeCatalogIdentity(product.name)).entries()
  ].filter(([identity, members]) => identity && members.length > 1);
  const duplicateProductIds = new Set(
    duplicateGroups.flatMap(([, members]) => members.map(({ id }) => id))
  );
  const productPlans = products.map((product) => {
    const fixtureEvidence = fixtureProductEvidence(product);
    const normalizedName = normalizeCanonicalProductName(product.name);
    const size = extractCanonicalSize(normalizedName);
    const blockingIssues = [];

    if (fixtureEvidence.length > 0) blockingIssues.push("TEST_FIXTURE");
    if (!isValidCustomerName(product.name)) blockingIssues.push("INVALID_CUSTOMER_NAME");
    if (!product.category.isActive && fixtureEvidence.length === 0)
      blockingIssues.push("INVALID_CATEGORY");
    if (Number(product.sellingPrice) <= 0) blockingIssues.push("INVALID_SELLING_PRICE");
    if (duplicateProductIds.has(product.id)) blockingIssues.push("UNRESOLVED_DUPLICATE");
    if (hasLifecycleDescriptionConflict(product)) blockingIssues.push("INTERNAL_DESCRIPTION");

    const recordSource = fixtureEvidence.length > 0 ? "TEST_FIXTURE" : "CATALOG";
    const dataQualityStatus =
      fixtureEvidence.length > 0
        ? "REJECTED"
        : blockingIssues.length > 0
          ? "NEEDS_REVIEW"
          : "APPROVED";
    const isStorefrontVisible = dataQualityStatus === "APPROVED" && product.status === "ACTIVE";

    return {
      after: {
        dataQualityStatus,
        isStorefrontVisible,
        name: fixtureEvidence.length > 0 ? product.name : normalizedName,
        recordSource,
        sizeUnit: fixtureEvidence.length > 0 ? null : (size?.unit ?? null),
        sizeValue: fixtureEvidence.length > 0 ? null : (size?.value ?? null)
      },
      before: product,
      blockingIssues,
      evidence: fixtureEvidence
    };
  });
  const categoryPlans = categories.map((category) => {
    const evidence = fixtureCategoryEvidence(category);
    const canonical = CANONICAL_CATEGORY_UPDATES[category.name];
    return {
      after: {
        dataQualityStatus: evidence.length > 0 ? "REJECTED" : "APPROVED",
        isActive: evidence.length > 0 ? false : category.isActive,
        isStorefrontVisible: evidence.length === 0 && category.isActive,
        name: canonical?.name ?? category.name,
        recordSource: evidence.length > 0 ? "TEST_FIXTURE" : "CATALOG",
        slug: canonical?.slug ?? category.slug
      },
      before: category,
      evidence
    };
  });

  return {
    categoryPlans,
    duplicateGroups,
    productPlans
  };
}

async function applyCleaningPlan(plan, beforeSnapshot) {
  return prisma.$transaction(
    async (transaction) => {
      let categoriesReclassified = 0;
      let categoriesRenamed = 0;
      let productsReclassified = 0;
      let productNamesNormalized = 0;
      let duplicateCandidatesCreated = 0;
      const auditRows = [];

      for (const categoryPlan of plan.categoryPlans) {
        const { before, after, evidence } = categoryPlan;
        const classificationChanged =
          before.recordSource !== after.recordSource ||
          before.dataQualityStatus !== after.dataQualityStatus ||
          before.isStorefrontVisible !== after.isStorefrontVisible ||
          before.isActive !== after.isActive;
        const renamed = before.name !== after.name || before.slug !== after.slug;
        if (!classificationChanged && !renamed) continue;

        await transaction.category.update({ data: after, where: { id: before.id } });
        if (classificationChanged) categoriesReclassified += 1;
        if (renamed) categoriesRenamed += 1;
        auditRows.push({
          action: renamed ? "NORMALIZE_AND_RECLASSIFY" : "RECLASSIFY",
          automated: true,
          actor: "catalog-clean-script",
          entityId: before.id,
          entityType: "CATEGORY",
          evidence: { after, before, fixtureEvidence: evidence },
          reason:
            evidence.length > 0
              ? "Exact integration-test category generator signature."
              : "Approved canonical category normalization derived from the live business catalog."
        });
      }

      for (const productPlan of plan.productPlans) {
        const { before, after, blockingIssues, evidence } = productPlan;
        const changed =
          before.recordSource !== after.recordSource ||
          before.dataQualityStatus !== after.dataQualityStatus ||
          before.isStorefrontVisible !== after.isStorefrontVisible ||
          before.name !== after.name ||
          before.sizeUnit !== after.sizeUnit ||
          decimalValue(before.sizeValue) !== decimalValue(after.sizeValue);
        if (!changed) continue;

        await transaction.product.update({ data: after, where: { id: before.id } });
        productsReclassified += 1;
        if (before.name !== after.name) {
          productNamesNormalized += 1;
          await transaction.productAlias.upsert({
            create: {
              canonicalProductId: before.id,
              evidence: { reason: "Preserved pre-normalization catalog name." },
              normalizedValue: normalizeCatalogIdentity(before.name),
              recordSource: "CATALOG",
              sourceReference: "catalog-clean-script",
              type: "RAW_NAME",
              value: before.name
            },
            update: { value: before.name },
            where: {
              canonicalProductId_type_normalizedValue: {
                canonicalProductId: before.id,
                normalizedValue: normalizeCatalogIdentity(before.name),
                type: "RAW_NAME"
              }
            }
          });
        }
        auditRows.push({
          action: before.name !== after.name ? "NORMALIZE_AND_RECLASSIFY" : "RECLASSIFY",
          automated: true,
          actor: "catalog-clean-script",
          canonicalProductId: before.id,
          entityId: before.id,
          entityType: "PRODUCT",
          evidence: {
            after,
            before: {
              dataQualityStatus: before.dataQualityStatus,
              isStorefrontVisible: before.isStorefrontVisible,
              name: before.name,
              recordSource: before.recordSource,
              sizeUnit: before.sizeUnit,
              sizeValue: decimalValue(before.sizeValue)
            },
            blockingIssues,
            fixtureEvidence: evidence
          },
          reason:
            evidence.length > 0
              ? "Exact test generator signature; retained for traceability but rejected from customer catalog."
              : blockingIssues.length > 0
                ? "Catalog record requires manual resolution before customer visibility."
                : "Catalog record passed the minimum customer data-quality gate."
        });
      }

      for (const [identity, members] of plan.duplicateGroups) {
        const [left, right] = [...members].sort((a, b) => a.id.localeCompare(b.id));
        if (!left || !right) continue;
        const existing = await transaction.productDuplicateCandidate.findUnique({
          where: {
            leftProductId_rightProductId: {
              leftProductId: left.id,
              rightProductId: right.id
            }
          }
        });
        if (existing) continue;

        const evidence = {
          identifierAgreement: false,
          normalizedName: identity,
          products: [productEvidence(left), productEvidence(right)]
        };
        await transaction.productDuplicateCandidate.create({
          data: {
            confidence: "0.5500",
            evidence,
            leftProductId: left.id,
            matchType: "NORMALIZED_IDENTITY",
            reason:
              "Names and sizes normalize identically, but SKU, barcode, unit, price, and stock evidence require manual review.",
            rightProductId: right.id,
            status: "PENDING"
          }
        });
        duplicateCandidatesCreated += 1;
        auditRows.push({
          action: "FLAG_DUPLICATE_CANDIDATE",
          automated: true,
          actor: "catalog-clean-script",
          entityId: `${left.id}:${right.id}`,
          entityType: "PRODUCT_PAIR",
          evidence,
          reason: "Normalized-name similarity is supporting evidence only; no merge was performed."
        });
      }

      for (const rows of chunks(auditRows, 500)) {
        await transaction.catalogAuditLog.createMany({ data: rows });
      }

      const inTransactionSnapshot = await relationshipSnapshot(transaction);
      assert.deepEqual(
        inTransactionSnapshot,
        beforeSnapshot,
        "Protected relationship totals changed inside the cleaning transaction."
      );

      return {
        categoriesReclassified,
        categoriesRenamed,
        duplicateCandidatesCreated,
        productNamesNormalized,
        productsReclassified
      };
    },
    { maxWait: 10_000, timeout: 120_000 }
  );
}

async function relationshipSnapshot(client) {
  const [
    products,
    categories,
    sales,
    saleItems,
    inventory,
    inventoryBatches,
    inventoryMovements,
    historical,
    forecasts,
    recommendations,
    customerOrders,
    customerOrderItems
  ] = await Promise.all([
    client.product.count(),
    client.category.count(),
    client.sale.count(),
    client.saleItem.aggregate({ _count: { _all: true }, _sum: { quantity: true } }),
    client.inventory.aggregate({ _count: { _all: true }, _sum: { quantityOnHand: true } }),
    client.inventoryBatch.aggregate({
      _count: { _all: true },
      _sum: { quantityReceived: true, quantityRemaining: true }
    }),
    client.inventoryMovement.aggregate({ _count: { _all: true }, _sum: { quantity: true } }),
    client.historicalMonthlySales.aggregate({
      _count: { _all: true },
      _sum: { quantitySold: true, salesAmount: true }
    }),
    client.forecastRecord.aggregate({
      _count: { _all: true },
      _sum: { forecastedDemand: true }
    }),
    client.recommendationRecord.count(),
    client.customerOrder.count(),
    client.customerOrderItem.aggregate({ _count: { _all: true }, _sum: { quantity: true } })
  ]);

  return JSON.parse(
    JSON.stringify({
      categories,
      customerOrderItems,
      customerOrders,
      forecasts,
      historical,
      inventory,
      inventoryBatches,
      inventoryMovements,
      products,
      recommendations,
      saleItems,
      sales
    })
  );
}

function printPlan(plan) {
  const fixtures = plan.productPlans.filter(
    (item) => item.after.recordSource === "TEST_FIXTURE"
  ).length;
  const visible = plan.productPlans.filter((item) => item.after.isStorefrontVisible).length;
  const review = plan.productPlans.filter(
    (item) => item.after.dataQualityStatus === "NEEDS_REVIEW"
  ).length;
  const fixtureCategories = plan.categoryPlans.filter(
    (item) => item.after.recordSource === "TEST_FIXTURE"
  ).length;
  console.info(`${shouldApply ? "Apply" : "Dry-run"} catalog cleaning plan`);
  console.info(`Products retained:             ${plan.productPlans.length}`);
  console.info(`Products classified fixtures: ${fixtures}`);
  console.info(`Products approved storefront: ${visible}`);
  console.info(`Products requiring review:    ${review}`);
  console.info(`Fixture categories retained:  ${fixtureCategories}`);
  console.info(`Duplicate groups flagged:     ${plan.duplicateGroups.length}`);
  console.info("Confirmed merges:              0");
}

function productEvidence(product) {
  return {
    barcode: product.barcode,
    category: product.category.name,
    id: product.id,
    name: product.name,
    sellingPrice: product.sellingPrice.toString(),
    sku: product.sku,
    unit: product.unit
  };
}

function decimalValue(value) {
  return value === null || value === undefined ? null : String(value);
}

function groupBy(values, keyFor) {
  const groups = new Map();
  for (const value of values) {
    const key = keyFor(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function chunks(values, size) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  );
}
