import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const categoriesPage = readFileSync(resolve(process.cwd(), "src/pages/CategoriesPage.tsx"), "utf8");
const categoryApi = readFileSync(resolve(process.cwd(), "src/services/categoryApi.ts"), "utf8");
const categoryCoverPanel = readFileSync(
  resolve(process.cwd(), "src/components/catalog/CategoryCoverUploadPanel.tsx"),
  "utf8"
);
const selectSource = readFileSync(resolve(process.cwd(), "src/components/ui/select.tsx"), "utf8");
const routesSource = readFileSync(resolve(process.cwd(), "src/app/routes.ts"), "utf8");

assert.match(routesSource, /path: "\/categories"/);
assert.match(routesSource, /allowedRoles: \["OWNER"\]/);

assert.match(categoriesPage, /fetchManagedCategories/);
assert.match(categoriesPage, /<AppPagination/);
assert.match(categoriesPage, /coverStatus/);
assert.match(categoriesPage, /visibility/);
assert.match(categoriesPage, /productCount/);
assert.match(categoriesPage, /<CategoryCoverUploadPanel/);
assert.match(categoriesPage, /Product images are never used as automatic category artwork/);

assert.match(categoryApi, /\/api\/catalog\/categories/);
assert.match(categoryApi, /pageSize/);
assert.match(categoryApi, /sortBy/);
assert.match(categoryApi, /getPublicCategoryCoverUrl/);

assert.match(categoryCoverPanel, /Choose a premium category image/);
assert.match(categoryCoverPanel, /Current storefront cover stays live/);
assert.match(categoryCoverPanel, /Use optimized cover/);
assert.match(categoryCoverPanel, /Remove active cover/);

assert.match(selectSource, /appearance-none/);
assert.match(selectSource, /right 0\.875rem center/);
assert.match(selectSource, /pr-10/);

console.log("Category management frontend contract passed.");
