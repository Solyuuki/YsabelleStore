import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const welcome = read("frontend/src/pages/WelcomePage.tsx");
const css = read("frontend/src/styles/welcome-appearance.css");
const shared = read("frontend/src/components/shared/AppPagination.tsx");

test("Staff login Known Accounts pagination opts into isolated appearance styling", () => {
  assert.match(
    welcome,
    /<AppPagination\s+className="ys-retail-known-accounts-pagination"\s+itemLabel="accounts"/
  );
  assert.match(welcome, /onPageChange=\{setRememberedAccountsPage\}/);
  assert.match(welcome, /page=\{currentRememberedAccountsPage\}/);
  assert.match(welcome, /pageSize=\{KNOWN_ACCOUNTS_PAGE_SIZE\}/);
  assert.match(welcome, /totalItems=\{rememberedAccounts\.length\}/);
  assert.match(shared, /"flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/);
});

test("Dark mode provides a dark surface with readable summary and navigation buttons", () => {
  assert.match(
    css,
    /:root\.dark \.ys-retail-welcome \.ys-retail-known-accounts-pagination\s*\{[^}]*background: #22334d !important;/
  );
  assert.match(
    css,
    /\.ys-retail-known-accounts-pagination > p\s*\{[^}]*color: #d6e2f3 !important;/
  );
  assert.match(
    css,
    /\.ys-retail-known-accounts-pagination nav button\s*\{[^}]*color: #f2f6ff !important;/
  );
  assert.match(
    css,
    /\.ys-retail-known-accounts-pagination nav button:disabled\s*\{[^}]*color: #bdcee5 !important;/
  );
  assert.match(
    css,
    /\.ys-retail-known-accounts-pagination nav button\[aria-current="page"\]\s*\{[^}]*background: #5146d9 !important;/
  );
  assert.match(
    css,
    /\.ys-retail-known-accounts-pagination nav button\[aria-current="page"\]\s*\{[^}]*color: #fff !important;/
  );
});

test("Known Accounts mobile pagination does not affect shared or other module pagers", () => {
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 359px\)/);
  assert.match(css, /\.ys-retail-known-accounts-pagination nav > ul\s*\{[^}]*flex-wrap: nowrap;/);
  assert.match(css, /\.ys-retail-known-accounts-pagination nav button\s*\{[^}]*min-height: 40px;/);
  const scoped = css.slice(css.indexOf("/* Sprint 12: staff-login Known Accounts paginator."));
  assert.ok(scoped.length > 0);
  assert.doesNotMatch(
    scoped,
    /ys-receiving-v2-|ys-delivery-pagination|ys-category-v2-|ys-products-v2-/
  );
});
