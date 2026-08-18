import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  CANONICAL_CATEGORY_UPDATES,
  extractCanonicalSize,
  fixtureCategoryEvidence,
  fixtureProductEvidence,
  normalizeCanonicalProductName,
  normalizeCatalogIdentity,
  normalizeCategoryIdentity,
  qualityIssuesForProduct
} from "./lib/catalog-quality.mjs";
import { MASTER_DATA_REVIEW_REQUIRED_ACTION } from "./lib/catalog-review-actions.mjs";

const prisma = new PrismaClient();
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
const outputPath = path.resolve(
  process.cwd(),
  outputArgument?.slice("--output=".length) ?? "reports/catalog-quality/current-catalog-audit.json"
);

try {
  const report = await buildReport();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.info(`Catalog quality audit written to ${path.relative(process.cwd(), outputPath)}.`);
  console.info(`Products:             ${report.summary.totalProducts}`);
  console.info(`Test fixtures:         ${report.summary.testFixtureProducts}`);
  console.info(`Current storefront:    ${report.summary.currentStorefrontEligible}`);
  console.info(`Quality-gate eligible: ${report.summary.qualityGateEligible}`);
  console.info(`Duplicate groups:      ${report.summary.duplicateGroups}`);
  console.info(`Unresolved products:   ${report.summary.unresolvedProducts}`);
} finally {
  await prisma.$disconnect();
}

async function buildReport() {
  const [
    products,
    categories,
    importRows,
    storedDuplicateCandidates,
    canonicalMappings,
    masterDataReviewLocks
  ] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        barcode: true,
        brand: true,
        category: {
          select: {
            dataQualityStatus: true,
            id: true,
            isActive: true,
            isStorefrontVisible: true,
            name: true,
            recordSource: true,
            slug: true
          }
        },
        categoryId: true,
        costPrice: true,
        createdAt: true,
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
        variant: true,
        _count: {
          select: {
            customerOrderItems: true,
            forecastRecords: true,
            historicalMonthlySales: true,
            inventoryBatches: true,
            inventoryMovements: true,
            recommendationRecords: true,
            saleItems: true
          }
        }
      }
    }),
    prisma.category.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        dataQualityStatus: true,
        isActive: true,
        isStorefrontVisible: true,
        name: true,
        recordSource: true,
        slug: true,
        _count: { select: { products: true } }
      }
    }),
    prisma.historicalSalesImportRow.findMany({
      select: {
        matchedProductId: true,
        normalizedBarcode: true,
        normalizedSku: true
      }
    }),
    prisma.productDuplicateCandidate.findMany({
      select: {
        confidence: true,
        leftProductId: true,
        reason: true,
        rightProductId: true,
        status: true
      }
    }),
    prisma.productCanonicalMapping.findMany({
      select: {
        action: true,
        canonicalProductId: true,
        matchType: true,
        sourceProductId: true
      }
    }),
    prisma.catalogAuditLog.findMany({
      select: { entityId: true },
      where: {
        action: MASTER_DATA_REVIEW_REQUIRED_ACTION,
        entityType: "PRODUCT"
      }
    })
  ]);
  const masterDataReviewProductIds = new Set(masterDataReviewLocks.map(({ entityId }) => entityId));

  const fixtureProductIds = new Set(
    products.filter((product) => fixtureProductEvidence(product).length > 0).map(({ id }) => id)
  );
  const businessProducts = products.filter(({ id }) => !fixtureProductIds.has(id));
  const normalizedNameGroups = groupBy(businessProducts, (product) =>
    normalizeCatalogIdentity(product.name)
  );
  const duplicateGroups = [...normalizedNameGroups.entries()]
    .filter(([identity, members]) => identity && members.length > 1)
    .map(([identity, members]) => ({
      evidence: {
        identifierAgreement: false,
        normalizedName: identity,
        reason:
          "Names normalize to the same identity, but SKU/barcode/price/stock evidence conflicts."
      },
      products: members.map(productReference),
      status: "PENDING_MANUAL_REVIEW"
    }));
  const duplicateProductIds = new Set(
    duplicateGroups.flatMap((group) => group.products.map(({ id }) => id))
  );
  const records = products.map((product) => {
    const fixtureEvidence = fixtureProductEvidence(product);
    const issues = [
      ...qualityIssuesForProduct(product, duplicateProductIds),
      ...(masterDataReviewProductIds.has(product.id) ? ["MASTER_DATA_REVIEW_REQUIRED"] : [])
    ];
    const blockingIssues = issues.filter((issue) =>
      [
        "INTERNAL_DESCRIPTION",
        "INVALID_CATEGORY",
        "INVALID_CUSTOMER_NAME",
        "INVALID_SELLING_PRICE",
        "MASTER_DATA_REVIEW_REQUIRED",
        "TEST_FIXTURE",
        "UNRESOLVED_DUPLICATE"
      ].includes(issue)
    );

    return {
      id: product.id,
      classification: fixtureEvidence.length > 0 ? "TEST_FIXTURE" : "CATALOG",
      qualityDecision:
        fixtureEvidence.length > 0
          ? "REJECTED"
          : blockingIssues.length > 0
            ? "NEEDS_REVIEW"
            : "APPROVED",
      storefrontDecision:
        product.status === "ACTIVE" && blockingIssues.length === 0 ? "ELIGIBLE" : "HIDDEN",
      evidence: fixtureEvidence,
      issues,
      original: {
        barcode: product.barcode,
        category: product.category.name,
        name: product.name,
        sku: product.sku,
        status: product.status,
        unit: product.unit
      },
      persisted: {
        brand: product.brand,
        dataQualityStatus: product.dataQualityStatus,
        isStorefrontVisible: product.isStorefrontVisible,
        recordSource: product.recordSource,
        sizeUnit: product.sizeUnit,
        sizeValue: product.sizeValue?.toString() ?? null,
        variant: product.variant
      },
      proposed: {
        category: CANONICAL_CATEGORY_UPDATES[product.category.name]?.name ?? product.category.name,
        name: normalizeCanonicalProductName(product.name),
        size: extractCanonicalSize(product.name)
      },
      relationships: product._count
    };
  });
  const categoryIdentityGroups = [
    ...groupBy(categories, (category) => normalizeCategoryIdentity(category.name)).entries()
  ]
    .filter(([identity, members]) => identity && members.length > 1)
    .map(([identity, members]) => ({
      identity,
      categories: members.map((category) => ({
        id: category.id,
        name: category.name,
        productCount: category._count.products,
        slug: category.slug
      }))
    }));
  const categoryRecords = categories.map((category) => {
    const evidence = fixtureCategoryEvidence(category);
    return {
      id: category.id,
      classification: evidence.length > 0 ? "TEST_FIXTURE" : "CATALOG",
      evidence,
      isActive: category.isActive,
      persisted: {
        dataQualityStatus: category.dataQualityStatus,
        isStorefrontVisible: category.isStorefrontVisible,
        recordSource: category.recordSource
      },
      name: category.name,
      productCount: category._count.products,
      proposed: CANONICAL_CATEGORY_UPDATES[category.name] ?? null,
      slug: category.slug
    };
  });
  const identifierConflicts = historicalIdentifierConflicts(importRows);
  const catalogRecords = records.filter((record) => record.classification === "CATALOG");

  return {
    generatedAt: new Date().toISOString(),
    policy: {
      destructiveMergesAllowed: false,
      fixtureDetection:
        "Exact test-generator signatures combine generated names, SKU/barcode formats, and fixture-category provenance; runtime storefront filtering does not use names.",
      mergePriority: [
        "BARCODE_OR_GTIN",
        "SKU",
        "SUPPLIER_PRODUCT_CODE",
        "NORMALIZED_BRAND_PRODUCT_VARIANT_SIZE",
        "NAME_SIMILARITY_SUPPORTING_ONLY"
      ],
      unresolvedMatches: "Flagged for review and excluded from the storefront; never auto-merged."
    },
    summary: {
      barcodeConflicts: identifierConflicts.barcode.length,
      categoryIdentityDuplicateGroups: categoryIdentityGroups.length,
      currentStorefrontEligible: products.filter(
        (product) =>
          product.status === "ACTIVE" &&
          product.dataQualityStatus === "APPROVED" &&
          product.isStorefrontVisible &&
          product.recordSource !== "TEST_FIXTURE" &&
          product.category.isActive &&
          product.category.dataQualityStatus === "APPROVED" &&
          product.category.isStorefrontVisible &&
          !storedDuplicateCandidates.some(
            (candidate) =>
              ["PENDING", "CONFIRMED"].includes(candidate.status) &&
              [candidate.leftProductId, candidate.rightProductId].includes(product.id)
          )
      ).length,
      canonicalMappings: canonicalMappings.length,
      canonicalProductsAfterCleaning: catalogRecords.filter(
        (record) => record.classification !== "TEST_FIXTURE"
      ).length,
      duplicateGroups: duplicateGroups.length,
      exactBarcodeDuplicates: 0,
      exactSkuDuplicates: 0,
      fixtureCategories: categoryRecords.filter(
        (category) => category.classification === "TEST_FIXTURE"
      ).length,
      missingBarcode: catalogRecords.filter((record) => record.issues.includes("MISSING_BARCODE"))
        .length,
      missingBrand: catalogRecords.filter((record) => record.issues.includes("MISSING_BRAND"))
        .length,
      missingCategory: catalogRecords.filter((record) => record.issues.includes("INVALID_CATEGORY"))
        .length,
      missingImage: catalogRecords.filter((record) => record.issues.includes("MISSING_IMAGE"))
        .length,
      missingSize: catalogRecords.filter((record) => record.issues.includes("MISSING_SIZE")).length,
      qualityGateEligible: records.filter((record) => record.storefrontDecision === "ELIGIBLE")
        .length,
      skuConflicts: identifierConflicts.sku.length,
      testFixtureProducts: fixtureProductIds.size,
      totalCategories: categories.length,
      totalProducts: products.length,
      unresolvedProducts: catalogRecords.filter(
        (record) => record.qualityDecision === "NEEDS_REVIEW"
      ).length
    },
    identifierConflicts,
    duplicateGroups,
    storedDuplicateCandidates: storedDuplicateCandidates.map((candidate) => ({
      ...candidate,
      confidence: candidate.confidence.toString()
    })),
    canonicalMappings,
    categoryIdentityGroups,
    categories: categoryRecords,
    products: records
  };
}

function groupBy(values, keyFor) {
  const groups = new Map();
  for (const value of values) {
    const key = keyFor(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function productReference(product) {
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

function historicalIdentifierConflicts(rows) {
  const sku = conflictingMatches(rows, "normalizedSku");
  const barcode = conflictingMatches(rows, "normalizedBarcode");
  return { barcode, sku };
}

function conflictingMatches(rows, field) {
  const matches = new Map();
  for (const row of rows) {
    const value = row[field];
    if (!value || !row.matchedProductId) continue;
    const productIds = matches.get(value) ?? new Set();
    productIds.add(row.matchedProductId);
    matches.set(value, productIds);
  }

  return [...matches.entries()]
    .filter(([, productIds]) => productIds.size > 1)
    .map(([value, productIds]) => ({ productIds: [...productIds].sort(), value }));
}
