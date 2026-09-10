import assert from "node:assert/strict";
import test from "node:test";

import { runStorefrontCategoryTaxonomyCleanup } from "../src/scripts/cleanupStorefrontCategoryTaxonomy.js";

test("storefront taxonomy cleanup refuses execution without the exact apply flag", async () => {
  await assert.rejects(
    () => runStorefrontCategoryTaxonomyCleanup({ apply: false }),
    /STOREFRONT_TAXONOMY_CLEANUP_EXPLICIT_APPLY_REQUIRED/
  );
});
