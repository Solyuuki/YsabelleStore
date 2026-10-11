import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const materialCss = read("frontend/src/styles/ysabelle-material.css");
const main = read("frontend/src/main.tsx");
const appLayout = read("frontend/src/layouts/AppLayout.tsx");
const customerLayout = read("frontend/src/layouts/CustomerLayout.tsx");
const card = read("frontend/src/components/ui/card.tsx");
const authFrame = read("frontend/src/components/customer/CustomerAuthFrame.tsx");
const dashboard = read("frontend/src/pages/DashboardPage.tsx");
const statCard = read("frontend/src/components/shared/StatCard.tsx");
const account = read("frontend/src/pages/customer/CustomerAccountPage.tsx");
const productCard = read("frontend/src/components/customer/ProductCard.tsx");
const recoveryCss = read("frontend/src/styles/customer-auth-recovery.css");

test("global Ysabelle material texture is loaded once and shared across app shells", () => {
  assert.match(main, /ysabelle-material\.css/);
  assert.match(materialCss, /--ys-material-noise:/);
  assert.match(materialCss, /--ys-material-facets:/);
  assert.match(materialCss, /--ys-glass-flow-overlay:/);
  assert.match(materialCss, /--ys-glass-flow-background:/);
  assert.match(materialCss, /feTurbulence/);
  assert.match(materialCss, /\.ys-material-canvas::after/);
  assert.match(materialCss, /\.ys-material-surface::before/);
  assert.match(materialCss, /\.ys-material-surface::before[\s\S]*var\(--ys-material-facets\)/);
  assert.match(materialCss, /\.ys-material-accent::before[\s\S]*var\(--ys-material-facets\)/);
  assert.match(materialCss, /\.ys-material-accent::before[\s\S]*opacity:\s*0\.68/);
  assert.match(materialCss, /background-blend-mode:\s*soft-light, soft-light, overlay/);
  assert.match(materialCss, /filter:\s*blur\(0\.22px\)/);
  assert.match(appLayout, /app-shell-ambient ys-material-canvas/);
  assert.match(customerLayout, /customer-app ys-material-canvas/);
});

test("shared internal cards and brand accents use the material system", () => {
  assert.match(card, /ys-material-surface/);
  assert.match(dashboard, /ys-material-accent flex h-9 w-9/);
  assert.match(statCard, /ys-material-accent flex h-9 w-9/);
});

test("customer account and storefront surfaces use the same material language", () => {
  assert.match(account, /customer-account-rail ys-material-surface/);
  assert.match(account, /customer-account-avatar ys-material-accent/);
  assert.match(account, /customer-account-hero ys-material-surface/);
  assert.match(account, /customer-account-hero__icon ys-material-accent/);
  assert.match(account, /customer-account-section ys-material-surface/);
  assert.match(productCard, /customer-product-card ys-material-surface/);
});

test("auth surfaces avoid double-texturing recovery while sharing the global token", () => {
  assert.match(authFrame, /mode === "recovery" \? "" : " ys-material-surface"/);
  assert.match(recoveryCss, /var\(--ys-material-noise\)/);
  assert.doesNotMatch(recoveryCss, /data:image\/svg\+xml/);
});

test("crystal facets cover shared brand-gradient controls", () => {
  assert.match(materialCss, /customer-auth-card__icon/);
  assert.match(materialCss, /customer-email-quick-sign__icon/);
  assert.match(materialCss, /customer-auth-submit/);
  assert.match(materialCss, /customer-account-nav button\[aria-selected="true"\]/);
  assert.match(materialCss, /customer-recovery-progress__step--active/);
  assert.match(recoveryCss, /var\(--ys-material-facets\)/);
});

test("global glass flow background is applied to primary app and customer shells", () => {
  assert.match(materialCss, /\.ys-glass-flow-background\s*\{/);
  assert.match(materialCss, /background-image:\s*var\(--ys-glass-flow-background\)/);
  assert.match(materialCss, /C260 25 440 380 810 318/);
  assert.match(appLayout, /ys-glass-flow-background/);
  assert.match(customerLayout, /ys-glass-flow-background/);
  assert.match(account, /customer-account-page-v2 ys-glass-flow-background/);
});

test("glass flow background avoids scroll-heavy effects", () => {
  assert.match(materialCss, /background-attachment:\s*scroll\s*!important/);
  assert.match(
    materialCss,
    /\.ys-glass-flow-background\.ys-material-canvas::after[\s\S]*display:\s*none/
  );
  assert.match(
    materialCss,
    /\.ys-glass-flow-background \.app-shell-orb,[\s\S]*\.welcome-ambient-blob[\s\S]*display:\s*none/
  );
  assert.doesNotMatch(materialCss, /feGaussianBlur/);
  assert.doesNotMatch(materialCss, /filter='url\(%23soft\)'/);
});

test("approved KPI card texture is scoped to Dashboard and Reports summary cards", () => {
  assert.match(dashboard, /ys-kpi-card-surface/);
  assert.match(statCard, /ys-kpi-card-surface/);
  assert.match(materialCss, /\.app-shell-ambient \.ys-kpi-card-surface\s*\{/);
  assert.match(materialCss, /kpi-card-frosted-ribbon\.webp/);
  assert.match(materialCss, /background-size:\s*cover,\s*auto\s*!important/);
  assert.match(
    materialCss,
    /\.app-shell-ambient \.ys-kpi-card-surface::before[\s\S]*opacity:\s*0\.9\s*!important/
  );
  assert.ok(
    fs.existsSync(path.join(REPO_ROOT, "frontend/public/textures/kpi-card-frosted-ribbon.webp"))
  );
});
