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

test("customer sign-in preserves a safe checkout return path", () => {
  assert.match(loginPage, /const requestedReturnTo = getCustomerReturnPath\(search\);/);
  assert.match(loginPage, /navigate\(passwordReturnTo\);/);
  assert.match(loginPage, /startCustomerSocialAuth\(provider, quickSignReturnTo, "login"\)/);
  assert.match(customerRoutes, /pathname === "\/account" \|\| pathname === "\/checkout"/);
  assert.match(customerRoutes, /buildCustomerAuthPath\("\/login", `\$\{pathname\}\$\{search\}`\)/);
  assert.match(customerRoutes, /return getCustomerReturnPath\(search\) \?\? "\/";/);
});

test("customer account loads Orders first and keeps Favorites, Profile and Security secondary", () => {
  assert.match(customerApp, /customer-account-premium\.css/);
  assert.match(
    customerAccountPage,
    /type AccountTab = "orders" \| "favorites" \| "profile" \| "security";/
  );
  assert.match(customerAccountPage, /useState<AccountTab>\("orders"\)/);
  assert.match(customerAccountPage, /role="tablist"/);
  assert.match(customerAccountPage, /aria-selected=\{activeTab === "orders"\}/);
  assert.match(customerAccountPage, /aria-selected=\{activeTab === "favorites"\}/);
  assert.match(customerAccountPage, /aria-selected=\{activeTab === "profile"\}/);
  assert.match(customerAccountPage, /aria-selected=\{activeTab === "security"\}/);
  assert.match(customerAccountPage, /hidden=\{activeTab !== "orders"\}/);
  assert.match(customerAccountPage, /hidden=\{activeTab !== "favorites"\}/);
  assert.match(customerAccountPage, /hidden=\{activeTab !== "profile"\}/);
  assert.match(customerAccountPage, /hidden=\{activeTab !== "security"\}/);
});

test("account tabs never use hash anchors that make the browser scroll", () => {
  assert.doesNotMatch(customerAccountPage, /href="#(?:orders|favorites|profile|security)"/);
  assert.match(customerAccountPage, /onClick=\{\(\) => setActiveTab\("orders"\)\}/);
  assert.match(customerAccountPage, /onClick=\{\(\) => setActiveTab\("favorites"\)\}/);
  assert.match(customerAccountPage, /onClick=\{\(\) => setActiveTab\("profile"\)\}/);
  assert.match(customerAccountPage, /onClick=\{\(\) => setActiveTab\("security"\)\}/);
  assert.doesNotMatch(premiumAccountCss, /:target/);
  assert.doesNotMatch(premiumAccountCss, /scroll-margin-top/);
});

test("account hero changes premium context with the active account tab", () => {
  assert.match(customerAccountPage, /const ACCOUNT_HERO_CONTENT: Record<\s*AccountTab,/);
  assert.match(customerAccountPage, /orders:[\s\S]*eyebrow: "Order center"/);
  assert.match(customerAccountPage, /orders:[\s\S]*title: "Your orders, organized\."/);
  assert.match(customerAccountPage, /favorites:[\s\S]*eyebrow: "Saved items"/);
  assert.match(customerAccountPage, /favorites:[\s\S]*title: "Favorites, ready when you are\."/);
  assert.match(customerAccountPage, /profile:[\s\S]*eyebrow: "Profile"/);
  assert.match(customerAccountPage, /profile:[\s\S]*title: "Your details, ready for checkout\."/);
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
    /\.customer-account-hero > \.customer-account-hero__content\s*\{[\s\S]*?max-width:\s*none;[\s\S]*?width:\s*100%;[\s\S]*?display:\s*block;/
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
  assert.match(
    premiumAccountCss,
    /\.customer-account-identity-card h1\s*\{[\s\S]*white-space:\s*nowrap;/
  );
  assert.match(premiumAccountCss, /\.customer-account-signout\s*\{[\s\S]*width:\s*auto;/);
  assert.match(premiumAccountCss, /\.customer-account-nav button\s*\{/);
  assert.match(premiumAccountCss, /\.customer-account-nav button\[aria-selected="true"\]/);
});

test("account hero does not duplicate the existing shop navigation", () => {
  assert.doesNotMatch(customerAccountPage, /customer-account-shop-button/);
  assert.doesNotMatch(customerAccountPage, />\s*Continue shopping\s*</);
});

test("dark account pagination keeps all page controls readable", () => {
  const css = fs.readFileSync(
    path.join(REPO_ROOT, "frontend", "src", "styles", "theme-storefront-contrast.css"),
    "utf8"
  );
  const pager =
    customerAccountPage.match(
      /className="customer-account-history-pagination(?: customer-account-favorites-pagination)?"/g
    ) ?? [];
  assert.equal(pager.length, 2, "Orders and Favorites must share the themed pager");
  assert.match(
    css,
    /:root\.dark \.customer-app \.customer-account-history-pagination :is\(p, label\)/
  );
  assert.match(
    css,
    /\.customer-account-history-pagination nav button:not\(\[aria-current="page"\]\)/
  );
  assert.match(css, /\.customer-account-history-pagination nav button\[aria-current="page"\]/);
  assert.match(
    css,
    /\.customer-account-history-pagination nav button:disabled:not\(\[aria-current="page"\]\)/
  );
  assert.match(css, /\.customer-account-history-pagination nav button:focus-visible/);
  assert.match(css, /button\[aria-current="page"\]\s*\{[^}]*opacity: 1;/);
});

test("order history always has a visible pager and limits cards to three per page", () => {
  assert.match(customerAccountPage, /const historyPageSize = 3;/);
  assert.match(
    customerAccountPage,
    /historicalOrders\.slice\(\(historyPage - 1\) \* historyPageSize, historyPage \* historyPageSize\)/
  );
  assert.match(
    customerAccountPage,
    /const historyTotalPages = Math\.max\(1, Math\.ceil\(historicalOrders\.length \/ historyPageSize\)\)/
  );
  assert.match(
    customerAccountPage,
    /if \(historyPage > historyTotalPages\) setHistoryPage\(historyTotalPages\)/
  );

  const historyPanel = customerAccountPage.split('className="customer-account-order-list-v2"')[1];
  assert.ok(historyPanel, "Missing historical order list");
  assert.match(historyPanel, /paginatedHistoricalOrders\.map\(\(order\) =>/);
  assert.match(
    historyPanel,
    /<AppPagination[\s\S]*?itemLabel="orders"[\s\S]*?onPageChange=\{setHistoryPage\}/
  );
  assert.doesNotMatch(
    historyPanel.split("</AppPagination>")[0],
    /historicalOrders\.length > historyPageSize/
  );

  for (const [length, expected] of [
    [1, 1],
    [3, 1],
    [4, 2],
    [22, 8]
  ]) {
    assert.equal(Math.max(1, Math.ceil(length / 3)), expected);
  }
});

test("mobile active delivery tracking stays inside phone width without horizontal timeline clipping", () => {
  const breakpoint = premiumAccountCss.split(
    "/* Sprint 12: fit live delivery details inside narrow phones."
  )[1];
  assert.ok(breakpoint, "Missing mobile delivery width repair");
  assert.match(breakpoint, /@media \(max-width: 720px\)/);
  assert.match(
    breakpoint,
    /\.customer-account-order-v2--active\s*\{[^}]*min-width: 0;[^}]*max-width: 100%/
  );
  assert.match(
    breakpoint,
    /\.customer-account-delivery-overview\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/
  );
  assert.match(
    breakpoint,
    /\.customer-account-delivery-overview > div:first-child\s*\{\s*grid-column: 1 \/ -1;/
  );
  assert.match(breakpoint, /\.customer-delivery-progress\s*\{[^}]*overflow: visible;/);
  assert.match(
    breakpoint,
    /\.customer-delivery-stepper\s*\{[^}]*min-width: 0;[^}]*grid-template-columns: minmax\(0, 1fr\);/
  );
  assert.match(
    breakpoint,
    /\.customer-delivery-stepper > li\s*\{[^}]*grid-template-columns: 30px minmax\(0, 1fr\);/
  );
  assert.match(
    breakpoint,
    /\.customer-delivery-stepper__connector\s*\{[^}]*width: 2px;[^}]*height: calc\(100% - 27px\);/
  );
  assert.match(
    breakpoint,
    /\.customer-account-delivery-address, \.customer-account-delivery-courier\) > span\s*\{[^}]*min-width: 0;/
  );
  assert.match(breakpoint, /\.customer-account-history-pagination\s*\{[^}]*padding: 10px;/);
  assert.doesNotMatch(breakpoint, /overflow-x:\s*(?:hidden|auto)/);
});
