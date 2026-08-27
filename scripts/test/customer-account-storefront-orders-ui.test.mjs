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
  assert.match(customerAccountPage, /type AccountTab = "orders" \| "profile" \| "security";/);
  assert.match(customerAccountPage, /useState<AccountTab>\("orders"\)/);
  assert.match(customerAccountPage, /role="tablist"/);
  assert.match(customerAccountPage, /aria-selected=\{activeTab === "orders"\}/);
  assert.match(customerAccountPage, /aria-selected=\{activeTab === "profile"\}/);
  assert.match(customerAccountPage, /aria-selected=\{activeTab === "security"\}/);
  assert.match(customerAccountPage, /hidden=\{activeTab !== "orders"\}/);
  assert.match(customerAccountPage, /hidden=\{activeTab !== "profile"\}/);
  assert.match(customerAccountPage, /hidden=\{activeTab !== "security"\}/);
});

test("account tabs never use hash anchors that make the browser scroll", () => {
  assert.doesNotMatch(customerAccountPage, /href="#(?:orders|profile|security)"/);
  assert.match(customerAccountPage, /onClick=\{\(\) => setActiveTab\("orders"\)\}/);
  assert.match(customerAccountPage, /onClick=\{\(\) => setActiveTab\("profile"\)\}/);
  assert.match(customerAccountPage, /onClick=\{\(\) => setActiveTab\("security"\)\}/);
  assert.doesNotMatch(premiumAccountCss, /:target/);
  assert.doesNotMatch(premiumAccountCss, /scroll-margin-top/);
});

test("account hero changes premium context with the active account tab", () => {
  assert.match(customerAccountPage, /const ACCOUNT_HERO_CONTENT: Record<\s*AccountTab,/);
  assert.match(customerAccountPage, /orders:[\s\S]*eyebrow: "Order center"/);
  assert.match(customerAccountPage, /orders:[\s\S]*title: "Your orders, organized\."/);
  assert.match(customerAccountPage, /profile:[\s\S]*eyebrow: "Profile"/);
  assert.match(customerAccountPage, /profile:[\s\S]*title: "Your identity, your account\."/);
  assert.match(customerAccountPage, /security:[\s\S]*eyebrow: "Account security"/);
  assert.match(customerAccountPage, /security:[\s\S]*title: "Protect your account\."/);
  assert.match(customerAccountPage, /const heroContent = ACCOUNT_HERO_CONTENT\[activeTab\]/);
  assert.match(customerAccountPage, /customer-account-hero--\$\{activeTab\}/);
  assert.match(customerAccountPage, /key=\{activeTab\}/);
  assert.match(premiumAccountCss, /\.customer-account-hero--orders/);
  assert.match(premiumAccountCss, /\.customer-account-hero--profile/);
  assert.match(premiumAccountCss, /\.customer-account-hero--security/);
  assert.match(premiumAccountCss, /\.customer-account-hero__icon/);
  assert.match(premiumAccountCss, /@keyframes customer-account-hero-enter/);
  assert.match(premiumAccountCss, /min-height:\s*190px/);
});

test("dynamic account hero keeps its icon in the card's top-right corner", () => {
  assert.match(
    premiumAccountCss,
    /\.customer-account-hero > \.customer-account-hero__content\s*\{[\s\S]*?display:\s*block;/
  );
  assert.match(
    premiumAccountCss,
    /\.customer-account-hero__content > div\s*\{[\s\S]*?padding-right:\s*96px;/
  );
  assert.match(
    premiumAccountCss,
    /\.customer-account-hero__icon\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*0;[\s\S]*?right:\s*0;/
  );
});

test("premium account shell removes the oversized sidebar presentation", () => {
  assert.match(premiumAccountCss, /\.customer-account-rail\s*\{[\s\S]*position:\s*static;/);
  assert.match(premiumAccountCss, /\.customer-account-identity-card\s*\{[\s\S]*display:\s*flex;/);
  assert.match(premiumAccountCss, /\.customer-account-identity-card h1\s*\{[\s\S]*white-space:\s*nowrap;/);
  assert.match(premiumAccountCss, /\.customer-account-signout\s*\{[\s\S]*width:\s*auto;/);
  assert.match(premiumAccountCss, /\.customer-account-nav button\s*\{/);
  assert.match(premiumAccountCss, /\.customer-account-nav button\[aria-selected="true"\]/);
});

test("account hero does not duplicate the existing shop navigation", () => {
  assert.doesNotMatch(customerAccountPage, /customer-account-shop-button/);
  assert.doesNotMatch(customerAccountPage, />\s*Continue shopping\s*</);
});
