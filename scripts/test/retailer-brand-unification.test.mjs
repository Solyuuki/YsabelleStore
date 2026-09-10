import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("retailer shell uses the approved shared Ysabelle brand mark", () => {
  const main = read("frontend/src/main.tsx");
  const sidebar = read("frontend/src/components/app/AppSidebar.tsx");

  assert.match(main, /import "@\/styles\/brand\.css";/);
  assert.match(sidebar, /YsabelleBrandMark/);
  assert.match(sidebar, /<YsabelleBrandMark[^>]*eager[^>]*variant="mini"/);
  assert.doesNotMatch(sidebar, /\bBrandLogo\b/);
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

test("shared form controls use the approved indigo focus outline", () => {
  const input = read("frontend/src/components/ui/input.tsx");
  const select = read("frontend/src/components/ui/select.tsx");
  const textarea = read("frontend/src/components/ui/textarea.tsx");

  for (const control of [input, select, textarea]) {
    assert.match(control, /focus-visible:ring-2 focus-visible:ring-indigo-500/);
    assert.doesNotMatch(control, /focus-visible:ring-(?:emerald|green)-/);
  }
});

test("retailer and staff-login ambient surfaces inherit the ecommerce palette", () => {
  const themePath = "frontend/src/styles/retailer-brand.css";
  assert.equal(existsSync(fileUrl(themePath)), true, "retailer brand stylesheet must exist");

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

test("logout confirmation uses the approved ecommerce palette", () => {
  const modal = read("frontend/src/components/shared/LogoutConfirmationModal.tsx");

  assert.match(modal, /rounded-xl border border-indigo-100 bg-white\/95/);
  assert.match(modal, /border-indigo-200 bg-indigo-50\/80/);
  assert.match(modal, /bg-gradient-to-r from-rose-500 via-fuchsia-500 to-fuchsia-600/);
  assert.doesNotMatch(
    modal,
    /border-emerald-100|bg-emerald-50\/80|text-emerald-800|bg-amber-600|hover:bg-amber-700/
  );
});
