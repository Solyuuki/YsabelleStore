import { CatalogQualityStatus, CatalogRecordSource, ProductStatus } from "@prisma/client";

import {
  RESTRICTED_ALCOHOL_SOURCE_PRODUCT_IDS,
  STOREFRONT_CATEGORY_NAMES
} from "./storefront-category-taxonomy.js";
import {
  PRODUCTION_CATALOG_50_EXPECTED_COUNT,
  PRODUCTION_CATALOG_50_TARGETS,
  type ProductionCatalog50Target
} from "./catalog-production-ready-50-manifest.js";

type DecimalLike = {
  lessThanOrEqualTo(value: number): boolean;
  toString(): string;
};

type ProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  costPrice: DecimalLike | null;
  sellingPrice: DecimalLike;
  status: string;
  recordSource: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  categoryId: string;
  category: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    recordSource: string;
    dataQualityStatus: string;
    isStorefrontVisible: boolean;
  };
  inventory: { id: string } | null;
  sourceMapping: { id: string } | null;
  sarimaSourceMapping: { sourceProductId: string } | null;
  duplicateCandidatesLeft: Array<{ status: string }>;
  duplicateCandidatesRight: Array<{ status: string }>;
};

type BarcodeOwnerRow = {
  id: string;
  sku: string;
  barcode: string | null;
};

export type ProductionCatalog50Client = {
  $transaction<T>(callback: (tx: ProductionCatalog50Client) => Promise<T>): Promise<T>;
  product: {
    findMany(args: unknown): Promise<unknown[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  category: {
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  catalogAuditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

type ProductPlanRow = {
  id: string;
  sku: string;
  sourceProductId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  currentBarcode: string;
  manufacturerBarcode: string;
  currentDescription: string | null;
  description: string;
  currentStatus: string;
  currentDataQualityStatus: string;
  currentStorefrontVisible: boolean;
  missingProcurementCost: boolean;
  requiresWrite: boolean;
};

type CategoryPlanRow = {
  id: string;
  name: string;
  currentDataQualityStatus: string;
  currentStorefrontVisible: boolean;
};

export type ProductionCatalog50Plan = {
  summary: {
    selectedProducts: number;
    productWritesRequired: number;
    alreadyAlignedProducts: number;
    categoryWritesRequired: number;
    missingProcurementCostWarnings: number;
  };
  products: ProductPlanRow[];
  categoriesToApprove: CategoryPlanRow[];
};

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function hasValidGs1CheckDigit(value: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;

  const digits = value.split("").map(Number);
  const expected = digits.pop();
  let sum = 0;
  let weight = 3;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const digit = digits[index];
    if (digit === undefined) return false;
    sum += digit * weight;
    weight = weight === 3 ? 1 : 3;
  }

  return (10 - (sum % 10)) % 10 === expected;
}

function assertManifest(targets: readonly ProductionCatalog50Target[]) {
  if (targets.length !== PRODUCTION_CATALOG_50_EXPECTED_COUNT) {
    fail(
      "PRODUCTION_CATALOG_50_MANIFEST_COUNT_MISMATCH",
      `expected ${PRODUCTION_CATALOG_50_EXPECTED_COUNT} targets, found ${targets.length}`
    );
  }

  const sourceIds = new Set<string>();
  const barcodes = new Set<string>();
  const restrictedIds = new Set<string>(RESTRICTED_ALCOHOL_SOURCE_PRODUCT_IDS);

  for (const target of targets) {
    if (!/^P\d{3}$/.test(target.sourceProductId)) {
      fail(
        "PRODUCTION_CATALOG_50_INVALID_SOURCE_ID",
        `${target.sourceProductId} is not a valid SARIMA source product id`
      );
    }

    if (restrictedIds.has(target.sourceProductId)) {
      fail(
        "PRODUCTION_CATALOG_50_RESTRICTED_IDENTITY",
        `${target.sourceProductId} is retired by current storefront taxonomy policy`
      );
    }

    if (!hasValidGs1CheckDigit(target.manufacturerBarcode)) {
      fail(
        "PRODUCTION_CATALOG_50_INVALID_GTIN",
        `${target.sourceProductId} has invalid manufacturer barcode ${target.manufacturerBarcode}`
      );
    }

    const description = target.description.trim();
    if (
      description.length < 20 ||
      description.length > 255 ||
      /TO_COMPLETE|TO_RESEARCH|PENDING/i.test(description)
    ) {
      fail(
        "PRODUCTION_CATALOG_50_INVALID_DESCRIPTION",
        `${target.sourceProductId} does not have a production customer description`
      );
    }

    if (sourceIds.has(target.sourceProductId) || barcodes.has(target.manufacturerBarcode)) {
      fail(
        "PRODUCTION_CATALOG_50_DUPLICATE_MANIFEST_IDENTITY",
        `${target.sourceProductId} duplicates a source id or manufacturer barcode`
      );
    }

    sourceIds.add(target.sourceProductId);
    barcodes.add(target.manufacturerBarcode);
  }
}

const productSelect = {
  id: true,
  sku: true,
  barcode: true,
  name: true,
  description: true,
  costPrice: true,
  sellingPrice: true,
  status: true,
  recordSource: true,
  dataQualityStatus: true,
  isStorefrontVisible: true,
  categoryId: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      recordSource: true,
      dataQualityStatus: true,
      isStorefrontVisible: true
    }
  },
  inventory: { select: { id: true } },
  sourceMapping: { select: { id: true } },
  sarimaSourceMapping: { select: { sourceProductId: true } },
  duplicateCandidatesLeft: { select: { status: true } },
  duplicateCandidatesRight: { select: { status: true } }
} as const;

export async function buildProductionCatalog50Plan(input: {
  client: ProductionCatalog50Client;
  targets?: readonly ProductionCatalog50Target[];
}): Promise<ProductionCatalog50Plan> {
  const targets = input.targets ?? PRODUCTION_CATALOG_50_TARGETS;
  assertManifest(targets);

  const skus = targets.map((target) => `SARIMA-${target.sourceProductId}`);
  const products = (await input.client.product.findMany({
    where: { sku: { in: skus } },
    select: productSelect,
    orderBy: { sku: "asc" }
  })) as ProductRow[];

  if (products.length !== targets.length) {
    const found = new Set(products.map((row) => row.sku));
    const missing = skus.filter((sku) => !found.has(sku));
    fail(
      "PRODUCTION_CATALOG_50_IDENTITY_MISMATCH",
      `expected ${targets.length} products, found ${products.length}; missing: ${missing.join(", ")}`
    );
  }

  const productBySku = new Map(products.map((row) => [row.sku, row]));
  const canonicalCategories = new Set<string>(STOREFRONT_CATEGORY_NAMES);
  const plannedProducts: ProductPlanRow[] = [];

  for (const target of targets) {
    const sku = `SARIMA-${target.sourceProductId}`;
    const product = productBySku.get(sku);
    if (!product || product.sarimaSourceMapping?.sourceProductId !== target.sourceProductId) {
      fail(
        "PRODUCTION_CATALOG_50_IDENTITY_MISMATCH",
        `${target.sourceProductId} no longer matches its Product/SARIMA identity`
      );
    }

    const expectedSyntheticBarcode = `YSB-${sku}`;
    if (
      product.barcode !== expectedSyntheticBarcode &&
      product.barcode !== target.manufacturerBarcode
    ) {
      fail(
        "PRODUCTION_CATALOG_50_BARCODE_STATE_MISMATCH",
        `${sku} expected ${expectedSyntheticBarcode} or ${target.manufacturerBarcode}, found ${product.barcode ?? "NULL"}`
      );
    }

    if (product.recordSource === CatalogRecordSource.TEST_FIXTURE) {
      fail("PRODUCTION_CATALOG_50_TEST_FIXTURE", `${sku} is a test fixture`);
    }

    if (
      product.status === ProductStatus.DISCONTINUED ||
      product.dataQualityStatus === CatalogQualityStatus.REJECTED
    ) {
      fail(
        "PRODUCTION_CATALOG_50_REJECTED_OR_DISCONTINUED",
        `${sku} is ${product.dataQualityStatus}/${product.status}`
      );
    }

    if (product.sourceMapping !== null) {
      fail(
        "PRODUCTION_CATALOG_50_NON_CANONICAL_PRODUCT",
        `${sku} is a source/alias product rather than a canonical Product`
      );
    }

    if (!product.inventory?.id) {
      fail("PRODUCTION_CATALOG_50_INVENTORY_NOT_LINKED", `${sku} has no Inventory record`);
    }

    if (product.sellingPrice.lessThanOrEqualTo(0)) {
      fail("PRODUCTION_CATALOG_50_INVALID_SELLING_PRICE", `${sku} has no positive selling price`);
    }

    const unresolvedDuplicates = [
      ...product.duplicateCandidatesLeft,
      ...product.duplicateCandidatesRight
    ].filter((candidate) => ["PENDING", "CONFIRMED"].includes(candidate.status));
    if (unresolvedDuplicates.length > 0) {
      fail(
        "PRODUCTION_CATALOG_50_UNRESOLVED_DUPLICATE",
        `${sku} has ${unresolvedDuplicates.length} unresolved duplicate candidate(s)`
      );
    }

    const category = product.category;
    if (
      !category.isActive ||
      category.recordSource === CatalogRecordSource.TEST_FIXTURE ||
      category.dataQualityStatus === CatalogQualityStatus.REJECTED ||
      !canonicalCategories.has(category.name)
    ) {
      fail(
        "PRODUCTION_CATALOG_50_CATEGORY_NOT_READY",
        `${sku} category ${category.name} is not an active canonical storefront category`
      );
    }

    const requiresWrite =
      product.barcode !== target.manufacturerBarcode ||
      product.description !== target.description ||
      product.status !== ProductStatus.ACTIVE ||
      product.dataQualityStatus !== CatalogQualityStatus.APPROVED ||
      product.isStorefrontVisible !== true;

    plannedProducts.push({
      id: product.id,
      sku,
      sourceProductId: target.sourceProductId,
      name: product.name,
      categoryId: product.categoryId,
      categoryName: category.name,
      currentBarcode: product.barcode,
      manufacturerBarcode: target.manufacturerBarcode,
      currentDescription: product.description,
      description: target.description,
      currentStatus: product.status,
      currentDataQualityStatus: product.dataQualityStatus,
      currentStorefrontVisible: product.isStorefrontVisible,
      missingProcurementCost: !product.costPrice || product.costPrice.lessThanOrEqualTo(0),
      requiresWrite
    });
  }

  const barcodeOwners = (await input.client.product.findMany({
    where: {
      barcode: { in: targets.map((target) => target.manufacturerBarcode) }
    },
    select: { id: true, sku: true, barcode: true }
  })) as BarcodeOwnerRow[];

  const targetByBarcode = new Map(plannedProducts.map((row) => [row.manufacturerBarcode, row]));
  const collisions = barcodeOwners.filter((owner) => {
    if (!owner.barcode) return false;
    const target = targetByBarcode.get(owner.barcode);
    return !target || target.id !== owner.id;
  });
  if (collisions.length > 0) {
    fail(
      "PRODUCTION_CATALOG_50_BARCODE_COLLISION",
      collisions.map((row) => `${row.barcode}:${row.sku}`).join(", ")
    );
  }

  const categoriesToApprove = Array.from(
    new Map(
      products
        .filter(
          (product) =>
            product.category.dataQualityStatus !== CatalogQualityStatus.APPROVED ||
            product.category.isStorefrontVisible !== true
        )
        .map((product) => [
          product.category.id,
          {
            id: product.category.id,
            name: product.category.name,
            currentDataQualityStatus: product.category.dataQualityStatus,
            currentStorefrontVisible: product.category.isStorefrontVisible
          }
        ])
    ).values()
  ).sort((left, right) => left.name.localeCompare(right.name));

  return {
    summary: {
      selectedProducts: plannedProducts.length,
      productWritesRequired: plannedProducts.filter((row) => row.requiresWrite).length,
      alreadyAlignedProducts: plannedProducts.filter((row) => !row.requiresWrite).length,
      categoryWritesRequired: categoriesToApprove.length,
      missingProcurementCostWarnings: plannedProducts.filter((row) => row.missingProcurementCost)
        .length
    },
    products: plannedProducts,
    categoriesToApprove
  };
}

export async function executeProductionCatalog50(input: { client: ProductionCatalog50Client }) {
  return input.client.$transaction(async (tx) => {
    const plan = await buildProductionCatalog50Plan({ client: tx });

    for (const category of plan.categoriesToApprove) {
      const result = await tx.category.updateMany({
        where: {
          id: category.id,
          isActive: true,
          recordSource: { not: CatalogRecordSource.TEST_FIXTURE },
          dataQualityStatus: { not: CatalogQualityStatus.REJECTED },
          name: { in: [...STOREFRONT_CATEGORY_NAMES] }
        },
        data: {
          dataQualityStatus: CatalogQualityStatus.APPROVED,
          isStorefrontVisible: true
        }
      });

      if (result.count !== 1) {
        fail(
          "PRODUCTION_CATALOG_50_CATEGORY_WRITE_MISMATCH",
          `${category.name} conditional approval affected ${result.count} rows`
        );
      }

      await tx.catalogAuditLog.create({
        data: {
          entityType: "CATEGORY",
          entityId: category.id,
          action: "PRODUCTION_CATALOG_50_APPROVAL",
          reason: "Canonical category approved for the reviewed production catalog 50 set.",
          automated: true,
          actor: "catalog-production-ready-50",
          evidence: {
            before: {
              dataQualityStatus: category.currentDataQualityStatus,
              isStorefrontVisible: category.currentStorefrontVisible
            },
            after: {
              dataQualityStatus: CatalogQualityStatus.APPROVED,
              isStorefrontVisible: true
            }
          }
        }
      });
    }

    let productWritesApplied = 0;
    for (const product of plan.products) {
      if (!product.requiresWrite) continue;

      const expectedSyntheticBarcode = `YSB-${product.sku}`;
      const result = await tx.product.updateMany({
        where: {
          id: product.id,
          sku: product.sku,
          categoryId: product.categoryId,
          barcode: { in: [expectedSyntheticBarcode, product.manufacturerBarcode] },
          recordSource: { not: CatalogRecordSource.TEST_FIXTURE },
          dataQualityStatus: { not: CatalogQualityStatus.REJECTED },
          status: { not: ProductStatus.DISCONTINUED },
          sellingPrice: { gt: 0 },
          sourceMapping: { is: null },
          sarimaSourceMapping: { is: { sourceProductId: product.sourceProductId } },
          duplicateCandidatesLeft: {
            none: { status: { in: ["PENDING", "CONFIRMED"] } }
          },
          duplicateCandidatesRight: {
            none: { status: { in: ["PENDING", "CONFIRMED"] } }
          }
        },
        data: {
          barcode: product.manufacturerBarcode,
          description: product.description,
          dataQualityStatus: CatalogQualityStatus.APPROVED,
          status: ProductStatus.ACTIVE,
          isStorefrontVisible: true
        }
      });

      if (result.count !== 1) {
        fail(
          "PRODUCTION_CATALOG_50_PRODUCT_WRITE_MISMATCH",
          `${product.sku} conditional approval affected ${result.count} rows`
        );
      }

      productWritesApplied += 1;
      await tx.catalogAuditLog.create({
        data: {
          entityType: "PRODUCT",
          entityId: product.id,
          canonicalProductId: product.id,
          action: "PRODUCTION_CATALOG_50_APPROVAL",
          reason:
            "Applied reviewed manufacturer barcode and customer description; preserved price, category, inventory, and SARIMA identity.",
          automated: true,
          actor: "catalog-production-ready-50",
          evidence: {
            sourceProductId: product.sourceProductId,
            before: {
              barcode: product.currentBarcode,
              description: product.currentDescription,
              dataQualityStatus: product.currentDataQualityStatus,
              status: product.currentStatus,
              isStorefrontVisible: product.currentStorefrontVisible
            },
            after: {
              barcode: product.manufacturerBarcode,
              description: product.description,
              dataQualityStatus: CatalogQualityStatus.APPROVED,
              status: ProductStatus.ACTIVE,
              isStorefrontVisible: true
            },
            preserved: {
              categoryId: product.categoryId,
              categoryName: product.categoryName,
              sellingPrice: true,
              inventory: true,
              sarimaIdentity: true
            }
          }
        }
      });
    }

    return {
      summary: {
        ...plan.summary,
        productWritesApplied,
        categoryWritesApplied: plan.categoriesToApprove.length
      }
    };
  });
}

export { assertManifest as assertProductionCatalog50Manifest };
