import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  listCategoriesQuerySchema,
  updateCategorySchema
} from "../src/validators/category.validators.js";

test("category management query defaults and limits are stable", () => {
  assert.deepEqual(listCategoriesQuerySchema.parse({}), {
    coverStatus: "ALL",
    visibility: "ALL",
    status: "ALL",
    page: 1,
    pageSize: 20,
    sortBy: "updatedAt",
    sortOrder: "desc"
  });
  assert.throws(() => listCategoriesQuerySchema.parse({ pageSize: 101 }));
  assert.equal(listCategoriesQuerySchema.parse({ coverStatus: "MISSING" }).coverStatus, "MISSING");
});

test("category update requires a meaningful change", () => {
  assert.throws(() => updateCategorySchema.parse({}));
  assert.equal(updateCategorySchema.parse({ coverPosition: "LEFT" }).coverPosition, "LEFT");
  assert.equal(
    updateCategorySchema.parse({ coverPosition: "TOP_RIGHT" }).coverPosition,
    "TOP_RIGHT"
  );
  assert.equal(
    updateCategorySchema.parse({ coverPosition: "BOTTOM_LEFT" }).coverPosition,
    "BOTTOM_LEFT"
  );
  assert.equal(updateCategorySchema.parse({ description: "" }).description, null);
});

test("category management route remains owner-only", () => {
  const routeSource = readFileSync(resolve(process.cwd(), "src/routes/category.routes.ts"), "utf8");
  assert.match(routeSource, /categoryRouter\.get\("\/", requireRole\("OWNER"\)/);
  assert.match(routeSource, /categoryRouter\.post\("\/", requireRole\("OWNER"\)/);
  assert.match(routeSource, /categoryRouter\.patch\("\/:id", requireRole\("OWNER"\)/);
  assert.doesNotMatch(routeSource, /requireRole\("OWNER", "STAFF"\)/);
});

test("category cover persistence is separate from product image assets", () => {
  const schemaSource = readFileSync(
    resolve(process.cwd(), "../database/prisma/schema.prisma"),
    "utf8"
  );
  assert.match(schemaSource, /model CategoryImageAsset \{/);
  assert.match(schemaSource, /activeCoverAssetId/);
  assert.match(schemaSource, /coverStatus\s+CategoryCoverStatus/);
  assert.match(schemaSource, /coverPosition\s+CategoryCoverPosition/);
  assert.match(
    schemaSource,
    /enum CategoryCoverPosition \{[\s\S]*TOP_LEFT[\s\S]*TOP_RIGHT[\s\S]*BOTTOM_LEFT[\s\S]*BOTTOM_RIGHT[\s\S]*\}/
  );
});
