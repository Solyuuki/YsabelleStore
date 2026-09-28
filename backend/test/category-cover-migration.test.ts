import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  LEGACY_CATEGORY_COVER_SOURCES
} from "../src/modules/catalog-image/legacyCategoryCoverSources.js";
import {
  isTrustedLegacyRemoteCategoryCover,
  resolveLegacyLocalCategoryCoverSource
} from "../src/modules/catalog-image/legacyCategoryCoverMigration.js";

test("legacy category cover manifest has unique canonical slugs", () => {
  const slugs = LEGACY_CATEGORY_COVER_SOURCES.map((source) => source.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(slugs.includes("coffee-milk"));
  assert.ok(slugs.includes("juice-tea-soda-water"));
  assert.ok(slugs.includes("snacks-confectionery"));
});

test("legacy local category cover resolver rejects traversal and unrelated paths", () => {
  const repositoryRoot = path.resolve("C:/repo/YsabelleStore");
  const valid = resolveLegacyLocalCategoryCoverSource(
    repositoryRoot,
    "/images/discover/essentials/canned-goods-retail-display.webp"
  );

  assert.equal(
    valid,
    path.join(
      repositoryRoot,
      "frontend",
      "public",
      "images",
      "discover",
      "essentials",
      "canned-goods-retail-display.webp"
    )
  );

  for (const unsafe of [
    "/images/discover/essentials/../secret.webp",
    "/images/discover/other/canned-goods.webp",
    "/images/products/canned-goods.webp",
    "C:/images/canned-goods.webp",
    "/images/discover/essentials/canned-goods.webp?x=1"
  ]) {
    assert.equal(resolveLegacyLocalCategoryCoverSource(repositoryRoot, unsafe), null);
  }
});

test("legacy remote category cover migration only trusts the curated Cloudinary account", () => {
  assert.equal(
    isTrustedLegacyRemoteCategoryCover(
      "https://res.cloudinary.com/gnqoa3sp/image/upload/v1788805764/coffee-milk-premium-pexels-16444396.webp"
    ),
    true
  );

  for (const unsafe of [
    "http://res.cloudinary.com/gnqoa3sp/image/upload/test.webp",
    "https://res.cloudinary.com/other/image/upload/test.webp",
    "https://example.com/gnqoa3sp/image/upload/test.webp",
    "https://res.cloudinary.com/gnqoa3sp/raw/upload/test.webp",
    "https://res.cloudinary.com/gnqoa3sp/image/upload/test.webp?redirect=https://example.com"
  ]) {
    assert.equal(isTrustedLegacyRemoteCategoryCover(unsafe), false);
  }
});

test("migration manifest stays aligned with the temporary storefront fallback map", () => {
  const presentationSource = readFileSync(
    resolve(process.cwd(), "../frontend/src/utils/storefrontCategoryPresentation.ts"),
    "utf8"
  );

  for (const source of LEGACY_CATEGORY_COVER_SOURCES) {
    assert.match(presentationSource, new RegExp(`slug: ["']${source.slug}["']`));
    assert.ok(
      presentationSource.includes(source.imageUrl),
      `temporary storefront fallback must retain ${source.slug}`
    );
  }
});
