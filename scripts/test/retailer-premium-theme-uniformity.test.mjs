import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("retailer theme primitives use the blue-indigo-violet-pink brand system", () => {
  const dashboard = read("frontend/src/pages/DashboardPage.tsx");
  const badge = read("frontend/src/components/ui/badge.tsx");
  const pagination = read("frontend/src/components/ui/pagination.tsx");
  const appPagination = read("frontend/src/components/shared/AppPagination.tsx");
  const logout = read("frontend/src/components/shared/LogoutConfirmationModal.tsx");
  const retailerBrand = read("frontend/src/styles/retailer-brand.css");

  assert.doesNotMatch(dashboard, /emerald-|green-/);
  assert.match(dashboard, /from-blue-500/);
  assert.match(dashboard, /via-indigo-500/);
  assert.match(dashboard, /to-violet-500/);

  assert.doesNotMatch(badge, /emerald-|green-/);
  assert.match(badge, /success:[\s\S]*?border-indigo-200[\s\S]*?bg-indigo-50[\s\S]*?text-indigo-700/);
  assert.match(badge, /danger:[\s\S]*?border-rose-200[\s\S]*?bg-rose-50[\s\S]*?text-rose-700/);

  assert.doesNotMatch(pagination, /emerald-|green-/);
  assert.match(pagination, /focus-visible:ring-violet-500/);
  assert.match(pagination, /from-blue-500/);
  assert.match(pagination, /via-indigo-500/);
  assert.match(pagination, /to-violet-500/);

  assert.doesNotMatch(appPagination, /emerald-|green-/);
  assert.match(appPagination, /focus-visible:border-violet-500/);
  assert.match(appPagination, /focus-visible:ring-violet-100/);

  assert.doesNotMatch(logout, /emerald-|green-|bg-amber-600|hover:bg-amber-700/);
  assert.match(logout, /border-indigo-200/);
  assert.match(logout, /bg-indigo-50\/80/);
  assert.match(logout, /from-rose-500/);
  assert.match(logout, /to-fuchsia-600/);

  assert.match(retailerBrand, /--retailer-positive:/);
  assert.match(retailerBrand, /--retailer-accent:/);
  assert.match(retailerBrand, /\.app-shell-ambient \[class~="bg-emerald-50"\]/);
  assert.match(retailerBrand, /\.app-shell-ambient \[class~="bg-green-50"\]/);
  assert.match(retailerBrand, /\.app-shell-ambient \[class~="text-emerald-700"\]/);
  assert.match(retailerBrand, /\.app-shell-ambient \[class~="focus-visible:ring-emerald-500"\]:focus-visible/);
  assert.match(retailerBrand, /\.app-shell-ambient \[class~="hover:bg-emerald-50"\]:hover/);
});
