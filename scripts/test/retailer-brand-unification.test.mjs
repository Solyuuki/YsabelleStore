import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("retailer shell uses the same Ysabelle brand mark as the customer storefront", () => {
  const main = read("frontend/src/main.tsx");
  const sidebar = read("frontend/src/components/app/AppSidebar.tsx");

  assert.match(main, /import "@\/styles\/brand\.css";/);
  assert.match(sidebar, /YsabelleBrandMark/);
  assert.doesNotMatch(sidebar, /BrandLogo/);
});

test("retailer shell and navigation remove emerald brand styling", () => {
  const layout = read("frontend/src/layouts/AppLayout.tsx");
  const sidebar = read("frontend/src/components/app/AppSidebar.tsx");
  const nav = read("frontend/src/components/app/SidebarNavItem.tsx");
  const button = read("frontend/src/components/ui/button.tsx");

  assert.doesNotMatch(layout, /emerald/i);
  assert.doesNotMatch(sidebar, /emerald/i);
  assert.doesNotMatch(nav, /emerald/i);
  assert.doesNotMatch(button, /emerald/i);

  assert.match(layout, /bg-blue-200/);
  assert.match(layout, /bg-violet-200/);
  assert.match(layout, /bg-pink-200/);
  assert.match(nav, /indigo/);
  assert.match(button, /indigo/);
});

test("retailer and staff-login ambient surfaces inherit the ecommerce palette", () => {
  const themePath = "frontend/src/styles/retailer-brand.css";
  assert.equal(
    existsSync(fileUrl(themePath)),
    true,
    "retailer brand stylesheet must exist"
  );

  const main = read("frontend/src/main.tsx");
  const theme = read(themePath);

  assert.match(main, /import "@\/styles\/retailer-brand\.css";/);
  assert.match(theme, /\.app-shell-ambient/);
  assert.match(theme, /\.welcome-ambient/);
  assert.match(theme, /#008cff/i);
  assert.match(theme, /#625bff/i);
  assert.match(theme, /#f43f8c/i);
  assert.match(theme, /--primary:\s*243 100% 68%/);
  assert.match(theme, /\.welcome-ambient input:focus-visible/);
  assert.match(
    theme,
    /\.welcome-ambient \.border-emerald-700\s*\{[\s\S]*?border-color:\s*#5149d9\s*!important;/
  );
  assert.doesNotMatch(theme, /#10b981|#059669|#047857|rgba\(167,\s*243,\s*208/i);
});
