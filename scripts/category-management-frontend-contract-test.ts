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
const productsSource = readFileSync(resolve(process.cwd(), "src/pages/ProductsPageLegacy.tsx"), "utf8");
const homeSource = readFileSync(
  resolve(process.cwd(), "src/pages/customer/CustomerHomePage.tsx"),
  "utf8"
);
const storefrontTypes = readFileSync(resolve(process.cwd(), "src/types/storefront.ts"), "utf8");

assert.match(routesSource, /path: "\/categories"/);
assert.match(routesSource, /allowedRoles: \["OWNER"\]/);

assert.match(categoriesPage, /fetchManagedCategories/);
assert.match(categoriesPage, /<AppPagination/);
assert.match(categoriesPage, /coverStatus/);
assert.match(categoriesPage, /visibility/);
assert.match(categoriesPage, /productCount/);
assert.match(categoriesPage, /<CategoryCoverUploadPanel/);
assert.match(categoriesPage, /Product images are never used as automatic category artwork/);
assert.match(categoriesPage, /category-cover-horizontal-focus/);
assert.match(categoriesPage, /category-cover-vertical-focus/);
assert.match(categoriesPage, /composeCoverPosition/);
assert.match(categoriesPage, /Live crop preview/);
assert.match(categoriesPage, /Desktop/);
assert.match(categoriesPage, /Mobile/);

assert.match(categoryApi, /\/api\/catalog\/categories/);
assert.match(categoryApi, /pageSize/);
assert.match(categoryApi, /sortBy/);
assert.match(categoryApi, /getPublicCategoryCoverUrl/);
assert.match(categoryApi, /TOP_LEFT/);
assert.match(categoryApi, /BOTTOM_RIGHT/);

assert.match(categoryCoverPanel, /Choose a premium category image/);
assert.match(categoryCoverPanel, /Current storefront cover stays live/);
assert.match(categoryCoverPanel, /Use optimized cover/);
assert.match(categoryCoverPanel, /Remove active cover/);

assert.match(selectSource, /appearance-none/);
assert.match(selectSource, /right 0\.875rem center/);
assert.match(selectSource, /pr-10/);

assert.doesNotMatch(productsSource, /Add category/);
assert.doesNotMatch(productsSource, /handleCreateCategory/);
assert.doesNotMatch(productsSource, /isCategoryDialogOpen/);
assert.match(productsSource, /Manage categories/);
assert.match(productsSource, /Create a category first before saving this product/);


assert.match(storefrontTypes, /storefrontCover:/);
assert.doesNotMatch(storefrontTypes, /representativeProducts/);
assert.match(homeSource, /const managedCover = category\.storefrontCover/);
assert.doesNotMatch(homeSource, /getCategoryRepresentativeProducts/);
assert.doesNotMatch(homeSource, /home-category-card__assortment/);
assert.match(homeSource, /fallbackLabel="Category image pending"/);
assert.match(homeSource, /category\.storefrontCover \|\| getCategoryPresentation/);
assert.match(homeSource, /objectPosition=\{item\.objectPosition\}/);
assert.match(homeSource, /categoryCoverObjectPosition/);
assert.match(homeSource, /TOP_LEFT/);
assert.match(homeSource, /BOTTOM_RIGHT/);

console.log("Category management frontend contract passed.");
