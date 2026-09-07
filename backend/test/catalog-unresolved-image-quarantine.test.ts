import assert from "node:assert/strict";
import test from "node:test";

import {
  PROTECTED_REVIEWED_PRODUCT_CODE,
  UNRESOLVED_CATALOG_IMAGE_CLEANUP_EXPECTED_COUNT,
  UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES
} from "../src/modules/catalog/catalog-unresolved-image-cleanup-authorization.js";
import type {
  UnresolvedCatalogImageQuarantineClient,
  UnresolvedCatalogImageQuarantineTransaction
} from "../src/modules/catalog/catalog-unresolved-image-quarantine.js";

type Mapping = {
  sourceProductId: string;
  sourceProductName: string;
  canonicalProductId: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  recordSource: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  status: string;
};

async function loadModule() {
  const loaded = await import("../src/modules/catalog/catalog-unresolved-image-quarantine.js");
  assert.equal(typeof loaded.executeUnresolvedCatalogImageQuarantine, "function");
  return loaded;
}

function fakeClient(input: {
  mappings?: Mapping[];
  products?: Product[];
  updateCount?: number;
}) {
  const mappings = input.mappings ?? [];
  const products = input.products ?? [];
  const updates: unknown[] = [];
  let mappingFindArgs: unknown;
  let productFindArgs: unknown;

  const tx: UnresolvedCatalogImageQuarantineTransaction = {
    sarimaSourceProductMapping: {
      async findMany(args) {
        mappingFindArgs = args;
        return mappings;
      }
    },
    product: {
      async findMany(args) {
        productFindArgs = args;
        return products;
      },
      async updateMany(args) {
        updates.push(args);
        return { count: input.updateCount ?? products.length };
      }
    }
  };

  const client: UnresolvedCatalogImageQuarantineClient = {
    async $transaction(callback) {
      return callback(tx);
    }
  };

  return { client, updates, getMappingFindArgs: () => mappingFindArgs, getProductFindArgs: () => productFindArgs };
}

const p212Mapping: Mapping = {
  sourceProductId: "P212",
  sourceProductName: "Cow Bell Evaposarap",
  canonicalProductId: "canonical-p212"
};

const p212Product: Product = {
  id: "canonical-p212",
  sku: "SARIMA-P212",
  name: "Cow Bell Evaposarap",
  recordSource: "IMPORT",
  dataQualityStatus: "APPROVED",
  isStorefrontVisible: true,
  status: "ACTIVE"
};

test("frozen unresolved authorization contains exactly 53 unique identities and excludes P132", () => {
  assert.equal(
    UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES.length,
    UNRESOLVED_CATALOG_IMAGE_CLEANUP_EXPECTED_COUNT
  );
  assert.equal(
    new Set(UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES.map((row) => row.productCode)).size,
    UNRESOLVED_CATALOG_IMAGE_CLEANUP_EXPECTED_COUNT
  );
  assert.equal(
    UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES.some(
      (row) => row.productCode === PROTECTED_REVIEWED_PRODUCT_CODE
    ),
    false
  );
});

test("quarantine hides only mapped unresolved canonical products without deleting operational records", async () => {
  const quarantine = await loadModule();
  const fake = fakeClient({ mappings: [p212Mapping], products: [p212Product], updateCount: 1 });

  const result = await quarantine.executeUnresolvedCatalogImageQuarantine({ client: fake.client });

  assert.equal(result.summary.authorizedSourceIdentities, 53);
  assert.equal(result.summary.mappedCanonicalProducts, 1);
  assert.equal(result.summary.unmatchedSourceIdentities, 52);
  assert.equal(result.summary.newlyHiddenProducts, 1);
  assert.equal(result.summary.updatedProducts, 1);
  assert.equal(result.summary.preservedOperationalProducts, 1);
  assert.deepEqual(fake.updates, [
    {
      where: { id: { in: ["canonical-p212"] } },
      data: { dataQualityStatus: "NEEDS_REVIEW", isStorefrontVisible: false }
    }
  ]);
  assert.deepEqual(result.quarantined, [
    {
      sourceProductId: "P212",
      canonicalProductId: "canonical-p212",
      sku: "SARIMA-P212",
      sourceProductName: "Cow Bell Evaposarap"
    }
  ]);
  assert.ok(result.unmatchedSourceProductIds.includes("P232"));
});

test("quarantine is idempotent for products already hidden and marked NEEDS_REVIEW", async () => {
  const quarantine = await loadModule();
  const fake = fakeClient({
    mappings: [p212Mapping],
    products: [{ ...p212Product, dataQualityStatus: "NEEDS_REVIEW", isStorefrontVisible: false }]
  });

  const result = await quarantine.executeUnresolvedCatalogImageQuarantine({ client: fake.client });

  assert.equal(result.summary.alreadyQuarantinedProducts, 1);
  assert.equal(result.summary.updatedProducts, 0);
  assert.deepEqual(fake.updates, []);
});

test("quarantine fails closed when reviewed SARIMA source name drifts", async () => {
  const quarantine = await loadModule();
  const fake = fakeClient({
    mappings: [{ ...p212Mapping, sourceProductName: "Changed Cow Bell Name" }],
    products: [p212Product]
  });

  await assert.rejects(
    () => quarantine.executeUnresolvedCatalogImageQuarantine({ client: fake.client }),
    /CATALOG_UNRESOLVED_IMAGE_SOURCE_DRIFT/
  );
  assert.deepEqual(fake.updates, []);
});

test("quarantine refuses protected internal or test-fixture products", async () => {
  const quarantine = await loadModule();
  for (const recordSource of ["INTERNAL", "TEST_FIXTURE"]) {
    const fake = fakeClient({
      mappings: [p212Mapping],
      products: [{ ...p212Product, recordSource }]
    });
    await assert.rejects(
      () => quarantine.executeUnresolvedCatalogImageQuarantine({ client: fake.client }),
      /CATALOG_UNRESOLVED_IMAGE_RECORD_SOURCE_MISMATCH/
    );
    assert.deepEqual(fake.updates, []);
  }
});

test("quarantine fails closed when update count changes under the transaction", async () => {
  const quarantine = await loadModule();
  const fake = fakeClient({ mappings: [p212Mapping], products: [p212Product], updateCount: 0 });

  await assert.rejects(
    () => quarantine.executeUnresolvedCatalogImageQuarantine({ client: fake.client }),
    /CATALOG_UNRESOLVED_IMAGE_UPDATE_MISMATCH/
  );
});

test("quarantine requires the complete frozen authorization and protects P132", async () => {
  const quarantine = await loadModule();
  const fake = fakeClient({});

  await assert.rejects(
    () =>
      quarantine.executeUnresolvedCatalogImageQuarantine({
        client: fake.client,
        identities: UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES.slice(0, 52)
      }),
    /CATALOG_UNRESOLVED_IMAGE_AUTHORIZATION_MISMATCH/
  );

  const withP132 = UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES.map((row, index) =>
    index === 0
      ? { ...row, productCode: "P132", sourceName: "Bathroom Tissue Roll \/ Tissue Pack" }
      : row
  );
  await assert.rejects(
    () => quarantine.executeUnresolvedCatalogImageQuarantine({ client: fake.client, identities: withP132 }),
    /CATALOG_UNRESOLVED_IMAGE_PROTECTED_PRODUCT/
  );
});