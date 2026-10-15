import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("shared select reserves comfortable arrow clearance", () => {
  const select = read("frontend/src/components/ui/select.tsx");
  assert.match(select, /appearance-none/);
  assert.match(select, /pr-11/);
  assert.match(select, /backgroundPosition: "right 1rem center"/);
  assert.match(select, /SELECT_CHEVRON_BACKGROUND/);
});

test("categories retain their chevron on dark-mode filter surfaces", () => {
  const css = read("frontend/src/styles/theme-retail.css");
  const categories = read("frontend/src/pages/CategoriesPage.tsx");
  const categoryRule = css.match(
    /:root\.dark \.app-shell-ambient \.ys-category-page \.ys-category-filter select \{([^}]+)\}/
  );
  assert.ok(categoryRule, "Missing Categories dark-mode select surface");
  assert.match(categoryRule[1], /background-color: #263752 !important/);
  assert.doesNotMatch(categoryRule[1], /\bbackground\s*:/);
  const chevronSection = css.slice(css.indexOf("/* Sprint 11: reliable native-select chevrons"));
  assert.match(chevronSection, /\.ys-category-page \.ys-category-filter select/);
  assert.match(chevronSection, /background-image: url\("data:image\/svg\+xml/);
  assert.match(chevronSection, /background-position: right 1rem center/);
  assert.match(categories, /className="ys-category-filter/);
});

test("affected retail native selects use an opt-in, theme-aware chevron", () => {
  const css = read("frontend/src/styles/theme-retail.css");
  assert.match(css, /select\.ys-retail-select-chevron/);
  assert.match(css, /appearance: none/);
  assert.match(css, /padding-right: 2\.75rem !important/);
  assert.match(css, /background-position: right 1rem center !important/);
  assert.match(css, /:root\.dark \.app-shell-ambient select\.ys-retail-select-chevron/);

  for (const [path, count] of [
    ["frontend/src/pages/ForecastPage.tsx", 3],
    ["frontend/src/pages/CustomerSupportInboxPage.tsx", 3],
    ["frontend/src/pages/UserManagementPage.tsx", 3],
    ["frontend/src/pages/SettingsPage.tsx", 1],
    ["frontend/src/pages/ProductsPageLegacy.tsx", 2],
    ["frontend/src/components/catalog/ProductCatalogQoLEnhancements.tsx", 1]
  ]) {
    const page = read(path);
    assert.equal(
      page.split("ys-retail-select-chevron").length - 1,
      count,
      path + " chevron attachment count changed"
    );
  }
});

test("inventory custom filter retains a single chevron, safe gutter, and accessible themed options", () => {
  const inventory = read("frontend/src/pages/InventoryPage.tsx");
  const styles = read("frontend/src/styles/retail-inventory-mobile-v2.css");

  assert.match(inventory, /className="ys-inventory-filter-trigger"/);
  assert.match(inventory, /ys-inventory-filter-chevron h-4 w-4 shrink-0/);
  assert.match(inventory, /aria-haspopup="listbox"/);
  assert.match(inventory, /aria-expanded=\{open\}/);
  assert.match(inventory, /role="listbox"/);
  assert.match(inventory, /aria-selected=\{option.value === value\}/);
  assert.match(styles, /\.ys-inventory-filter-trigger\s*\{[^}]*gap: 0\.65rem;/);
  assert.match(styles, /:root.dark \.app-shell-ambient \.ys-inventory-filter-menu/);
  assert.match(styles, /background: #1c2d47;/);
  assert.doesNotMatch(inventory, /ys-retail-select-chevron/);
});

test("only dropdown presentation changed: no native select event handler overrides", () => {
  const css = read("frontend/src/styles/theme-retail.css");
  assert.doesNotMatch(
    css.slice(css.indexOf("/* Sprint 11: reliable native-select chevrons")),
    /pointer-events: none/
  );
});
