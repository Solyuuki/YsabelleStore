import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogPromotionDatabaseMutationPreview } from "../src/modules/catalog/catalog-promotion-database-mutation-preview.js";
import type { CatalogPromotionInactiveStagingRow } from "../src/modules/catalog/catalog-promotion-inactive-staging-plan.js";

const baseStagingRow: CatalogPromotionInactiveStagingRow = {
  productCode: "P001",
  plannedSku: "SARIMA-P001",
  plannedName: "Sample Shampoo Sachet 13mL",
  plannedCategory: "Personal Care",
  plannedSellingPrice: 8.5,
  sellingPriceProvenance: "LAST_RECORDED_HISTORICAL_PRICE_2025",
  sellingPriceUsage: "PROVISIONAL_INACTIVE_ONLY",
  currentSellingPrice: null,
  currentPriceReadiness: "UNVERIFIED",
  plannedUnit: "SACHET",
  unitEvidence: "EXPLICIT_SACHET",
  plannedStatus: "INACTIVE",
  plannedDataQualityStatus: "NEEDS_REVIEW",
  plannedRecordSource: "IMPORT",
  plannedStorefrontVisible: false,
  plannedCreateInventory: false,
  plannedCreateInventoryBatch: false,
  plannedCreateSarimaMapping: true,
  imageStatus: "EXACT_MATCH",
  assetFileIds: ["drive-1"],
  activationBlockers: ["CURRENT_SELLING_PRICE", "PHYSICAL_STOCK", "QUALITY_APPROVAL"]
};

type TestCategory = {
  id: string;
  name: string;
  slug?: string;
  isActive?: boolean;
  recordSource?: "CATALOG" | "IMPORT" | "TEST_FIXTURE" | "INTERNAL";
  dataQualityStatus?: "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
};

type ApprovedSeedCategoryReuse = {
  sourceCategory: string;
  existingCategoryId: string;
  decision: "REUSE_EXISTING";
  reuseBasis: "SEED_CATEGORY_EVIDENCE";
  blockers: string[];
};

function build(
  overrides: {
    stagingRows?: CatalogPromotionInactiveStagingRow[];
    categories?: TestCategory[];
    products?: Array<{ id: string; sku: string }>;
    mappings?: Array<{ sourceKey: string; sourceProductId: string; canonicalProductId: string }>;
    approvedSeedCategoryReuses?: ApprovedSeedCategoryReuse[];
  } = {}
) {
  return buildCatalogPromotionDatabaseMutationPreview({
    stagingRows: overrides.stagingRows ?? [baseStagingRow],
    categories: overrides.categories ?? [
      { id: "cat_personal_care", name: "Personal Care", slug: "personal-care" }
    ],
    products: overrides.products ?? [],
    mappings: overrides.mappings ?? [],
    approvedSeedCategoryReuses: overrides.approvedSeedCategoryReuses ?? []
  });
}

test("database mutation preview builds a safe inactive Product create payload without inventing cost price", () => {
  const preview = build();
  const row = preview.rows[0];

  assert.deepEqual(preview.summary, {
    candidates: 1,
    productCreateReady: 1,
    productCreateBlocked: 0,
    missingCategories: 0,
    developmentSeedCategoryMatches: 0,
    skuCollisions: 0,
    sourceProductMappingCollisions: 0,
    mappingMetadataPending: 1,
    nullableCostPriceRows: 1,
    plannedInventoryRows: 0,
    plannedInventoryBatchRows: 0
  });

  assert.equal(row?.productMutationReadiness, "READY");
  assert.equal(row?.mappingMutationReadiness, "NEEDS_SOURCE_METADATA");
  assert.equal(row?.costPricePolicy, "NULLABLE_NOT_INFERRED");
  assert.deepEqual(row?.plannedProductCreate, {
    categoryId: "cat_personal_care",
    sku: "SARIMA-P001",
    name: "Sample Shampoo Sachet 13mL",
    unit: "SACHET",
    costPrice: null,
    sellingPrice: 8.5,
    status: "INACTIVE",
    recordSource: "IMPORT",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  });
  assert.equal(row?.plannedSarimaMappingCreate, null);
  assert.deepEqual(row?.productBlockers, []);
  assert.deepEqual(row?.mappingBlockers, ["SOURCE_MAPPING_METADATA_CONTRACT"]);
});

test("database mutation preview blocks Product creation when the category cannot be resolved", () => {
  const preview = build({ categories: [] });
  const row = preview.rows[0];

  assert.equal(row?.productMutationReadiness, "BLOCKED");
  assert.equal(row?.plannedProductCreate, null);
  assert.deepEqual(row?.productBlockers, ["CATEGORY_NOT_FOUND"]);
  assert.equal(preview.summary.missingCategories, 1);
});

test("database mutation preview blocks exact development seed categories instead of treating them as operational taxonomy", () => {
  const preview = build({
    stagingRows: [{ ...baseStagingRow, plannedCategory: "Beverages" }],
    categories: [{ id: "cat_beverages", name: "Beverages", slug: "beverages" }]
  });
  const row = preview.rows[0];

  assert.equal(row?.productMutationReadiness, "BLOCKED");
  assert.equal(row?.plannedProductCreate, null);
  assert.deepEqual(row?.productBlockers, ["DEVELOPMENT_SEED_CATEGORY"]);
  assert.equal(preview.summary.developmentSeedCategoryMatches, 1);
  assert.equal(preview.summary.missingCategories, 0);
});

test("database mutation preview accepts an exact seed category only when the final category plan approved that exact reuse", () => {
  const preview = build({
    stagingRows: [
      {
        ...baseStagingRow,
        productCode: "P008",
        plannedSku: "SARIMA-P008",
        plannedName: "Century Tuna Flakes in Oil",
        plannedCategory: "Canned Goods"
      }
    ],
    categories: [
      {
        id: "cat_canned_goods",
        name: "Canned Goods",
        slug: "canned-goods",
        isActive: true,
        recordSource: "CATALOG",
        dataQualityStatus: "NEEDS_REVIEW"
      }
    ],
    approvedSeedCategoryReuses: [
      {
        sourceCategory: "Canned Goods",
        existingCategoryId: "cat_canned_goods",
        decision: "REUSE_EXISTING",
        reuseBasis: "SEED_CATEGORY_EVIDENCE",
        blockers: []
      }
    ]
  });

  assert.equal(preview.rows[0]?.productMutationReadiness, "READY");
  assert.equal(preview.rows[0]?.plannedProductCreate?.categoryId, "cat_canned_goods");
  assert.deepEqual(preview.rows[0]?.productBlockers, []);
  assert.equal(preview.summary.developmentSeedCategoryMatches, 0);
});

test("database mutation preview keeps seed categories blocked when approval does not match the exact category identity", () => {
  const preview = build({
    stagingRows: [{ ...baseStagingRow, plannedCategory: "Canned Goods" }],
    categories: [
      {
        id: "cat_canned_goods",
        name: "Canned Goods",
        slug: "canned-goods",
        isActive: true,
        recordSource: "CATALOG",
        dataQualityStatus: "NEEDS_REVIEW"
      }
    ],
    approvedSeedCategoryReuses: [
      {
        sourceCategory: "Canned Goods",
        existingCategoryId: "cat_other",
        decision: "REUSE_EXISTING",
        reuseBasis: "SEED_CATEGORY_EVIDENCE",
        blockers: []
      }
    ]
  });

  assert.equal(preview.rows[0]?.productMutationReadiness, "BLOCKED");
  assert.equal(preview.rows[0]?.plannedProductCreate, null);
  assert.deepEqual(preview.rows[0]?.productBlockers, ["DEVELOPMENT_SEED_CATEGORY"]);
});

test("same category name with a non-seed identity remains eligible for operational resolution", () => {
  const preview = build({
    stagingRows: [{ ...baseStagingRow, plannedCategory: "Beverages" }],
    categories: [
      { id: "cat_operational_beverages", name: "Beverages", slug: "beverages-operational" }
    ]
  });
  const row = preview.rows[0];

  assert.equal(row?.productMutationReadiness, "READY");
  assert.equal(row?.plannedProductCreate?.categoryId, "cat_operational_beverages");
  assert.deepEqual(row?.productBlockers, []);
});

test("database mutation preview reuses Frozen & Chilled for Frozen / Chilled through guarded slug equivalence", () => {
  const preview = build({
    stagingRows: [{ ...baseStagingRow, productCode: "P040", plannedCategory: "Frozen / Chilled" }],
    categories: [
      {
        id: "cat_frozen_chilled",
        name: "Frozen & Chilled",
        slug: "frozen-chilled",
        isActive: true,
        recordSource: "INTERNAL",
        dataQualityStatus: "APPROVED"
      }
    ]
  });
  const row = preview.rows[0];

  assert.equal(row?.productMutationReadiness, "READY");
  assert.equal(row?.plannedProductCreate?.categoryId, "cat_frozen_chilled");
  assert.deepEqual(row?.productBlockers, []);
  assert.equal(preview.summary.missingCategories, 0);
});

test("database mutation preview gives exact-name resolution priority over slug equivalence", () => {
  const preview = build({
    stagingRows: [{ ...baseStagingRow, plannedCategory: "Frozen / Chilled" }],
    categories: [
      {
        id: "cat_exact",
        name: "Frozen / Chilled",
        slug: "frozen-chilled-exact",
        isActive: true,
        recordSource: "IMPORT",
        dataQualityStatus: "APPROVED"
      },
      {
        id: "cat_slug_equivalent",
        name: "Frozen & Chilled",
        slug: "frozen-chilled",
        isActive: true,
        recordSource: "INTERNAL",
        dataQualityStatus: "APPROVED"
      }
    ]
  });

  assert.equal(preview.rows[0]?.plannedProductCreate?.categoryId, "cat_exact");
});

test("database mutation preview keeps unrelated or unsafe slug collisions blocked", () => {
  const unsafeCases: TestCategory[] = [
    {
      id: "cat_unrelated",
      name: "Different Category",
      slug: "frozen-chilled",
      isActive: true,
      recordSource: "INTERNAL",
      dataQualityStatus: "APPROVED"
    },
    {
      id: "cat_inactive",
      name: "Frozen & Chilled",
      slug: "frozen-chilled",
      isActive: false,
      recordSource: "INTERNAL",
      dataQualityStatus: "APPROVED"
    },
    {
      id: "cat_fixture",
      name: "Frozen & Chilled",
      slug: "frozen-chilled",
      isActive: true,
      recordSource: "TEST_FIXTURE",
      dataQualityStatus: "APPROVED"
    },
    {
      id: "cat_rejected",
      name: "Frozen & Chilled",
      slug: "frozen-chilled",
      isActive: true,
      recordSource: "IMPORT",
      dataQualityStatus: "REJECTED"
    }
  ];

  for (const category of unsafeCases) {
    const preview = build({
      stagingRows: [{ ...baseStagingRow, plannedCategory: "Frozen / Chilled" }],
      categories: [category]
    });

    assert.equal(preview.rows[0]?.productMutationReadiness, "BLOCKED", category.id);
    assert.equal(preview.rows[0]?.plannedProductCreate, null, category.id);
  }
});

test("database mutation preview does not reuse a development seed through slug equivalence", () => {
  const preview = build({
    stagingRows: [{ ...baseStagingRow, plannedCategory: "Canned / Goods" }],
    categories: [
      {
        id: "cat_canned_goods",
        name: "Canned Goods",
        slug: "canned-goods",
        isActive: true,
        recordSource: "CATALOG",
        dataQualityStatus: "NEEDS_REVIEW"
      }
    ],
    approvedSeedCategoryReuses: [
      {
        sourceCategory: "Canned Goods",
        existingCategoryId: "cat_canned_goods",
        decision: "REUSE_EXISTING",
        reuseBasis: "SEED_CATEGORY_EVIDENCE",
        blockers: []
      }
    ]
  });

  assert.equal(preview.rows[0]?.productMutationReadiness, "BLOCKED");
  assert.equal(preview.rows[0]?.plannedProductCreate, null);
});

test("database mutation preview blocks Product creation on unique SKU collision", () => {
  const preview = build({ products: [{ id: "prd_existing", sku: "SARIMA-P001" }] });
  const row = preview.rows[0];

  assert.equal(row?.productMutationReadiness, "BLOCKED");
  assert.equal(row?.plannedProductCreate, null);
  assert.deepEqual(row?.productBlockers, ["SKU_COLLISION"]);
  assert.equal(preview.summary.skuCollisions, 1);
});

test("database mutation preview surfaces source-product mapping collisions and never plans inventory mutations", () => {
  const preview = build({
    mappings: [
      {
        sourceKey: "existing-source-key",
        sourceProductId: "P001",
        canonicalProductId: "prd_existing"
      }
    ]
  });
  const row = preview.rows[0];

  assert.equal(row?.mappingMutationReadiness, "BLOCKED_COLLISION");
  assert.deepEqual(row?.mappingBlockers, ["SOURCE_PRODUCT_MAPPING_COLLISION"]);
  assert.equal(row?.existingMappingProductId, "prd_existing");
  assert.equal(preview.summary.sourceProductMappingCollisions, 1);
  assert.equal(preview.summary.plannedInventoryRows, 0);
  assert.equal(preview.summary.plannedInventoryBatchRows, 0);
});
