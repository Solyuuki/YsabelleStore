import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const loginPage = fs.readFileSync(
  path.join(REPO_ROOT, "frontend", "src", "pages", "customer", "CustomerLoginPage.tsx"),
  "utf8"
);
const customerRoutes = fs.readFileSync(
  path.join(REPO_ROOT, "frontend", "src", "utils", "customerRoutes.ts"),
  "utf8"
);
const customerApp = fs.readFileSync(
  path.join(REPO_ROOT, "frontend", "src", "app", "CustomerApp.tsx"),
  "utf8"
);
const customerAccountPage = fs.readFileSync(
  path.join(REPO_ROOT, "frontend", "src", "pages", "customer", "CustomerAccountPage.tsx"),
  "utf8"
);
const premiumAccountCssPath = path.join(
  REPO_ROOT,
  "frontend",
  "src",
  "styles",
  "customer-account-premium.css"
);
const premiumAccountCss = fs.existsSync(premiumAccountCssPath)
  ? fs.readFileSync(premiumAccountCssPath, "utf8")
  : "";

test("successful customer sign-in returns shoppers to the storefront", () => {
  assert.match(loginPage, /await login\([\s\S]*?navigate\("\/"\)/);
  assert.doesNotMatch(loginPage, /await login\([\s\S]*?navigate\("\/account"\)/);
  assert.match(
    customerRoutes,
    /\(pathname === "\/login" \|\| pathname === "\/register"\)[\s\S]*?return "\/";/
  );
});

test("customer account loads Orders first and keeps Profile and Security secondary", () => {
  assert.match(customerApp, /customer-account-premium\.css/);
  assert.match(premiumAccountCss, /\.customer-account-layout-v2\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
  assert.match(premiumAccountCss, /\.customer-account-nav\s*\{[\s\S]*display:\s*flex;/);
  assert.match(premiumAccountCss, /\.customer-account-nav a\[href="#orders"\][\s\S]*order:\s*-1;/);
  assert.match(
    premiumAccountCss,
    /\.customer-account-content-v2 > #profile,[\s\S]*#security[\s\S]*display:\s*none;/
  );
  assert.match(
    premiumAccountCss,
    /\.customer-account-content-v2 > #orders\s*\{[\s\S]*display:\s*block;/
  );
  assert.match(premiumAccountCss, /#profile:target/);
  assert.match(premiumAccountCss, /#security:target/);
  assert.match(premiumAccountCss, /#orders:target/);
});

test("premium account shell removes the oversized sidebar presentation", () => {
  assert.match(premiumAccountCss, /\.customer-account-rail\s*\{[\s\S]*position:\s*static;/);
  assert.match(premiumAccountCss, /\.customer-account-identity-card\s*\{[\s\S]*display:\s*flex;/);
  assert.match(premiumAccountCss, /\.customer-account-identity-card h1\s*\{[\s\S]*white-space:\s*nowrap;/);
  assert.match(premiumAccountCss, /\.customer-account-signout\s*\{[\s\S]*width:\s*auto;/);
});

test("account hero does not duplicate the existing shop navigation", () => {
  assert.doesNotMatch(customerAccountPage, /customer-account-shop-button/);
  assert.doesNotMatch(customerAccountPage, />\s*Continue shopping\s*</);
});
