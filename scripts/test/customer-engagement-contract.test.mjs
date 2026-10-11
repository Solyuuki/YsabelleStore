import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  productCard,
  productDetail,
  accountPage,
  homePage,
  storefrontService,
  accountRoutes,
  storefrontRoutes,
  moderationRoutes
] = await Promise.all([
  readFile(
    new URL("../../frontend/src/components/customer/ProductCard.tsx", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../../frontend/src/pages/customer/ProductDetailPage.tsx", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../../frontend/src/pages/customer/CustomerAccountPage.tsx", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../../frontend/src/pages/customer/CustomerHomePage.tsx", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../../backend/src/services/storefrontService.ts", import.meta.url), "utf8"),
  readFile(new URL("../../backend/src/routes/customerAccount.routes.ts", import.meta.url), "utf8"),
  readFile(new URL("../../backend/src/routes/storefront.routes.ts", import.meta.url), "utf8"),
  readFile(new URL("../../backend/src/routes/customerAdmin.routes.ts", import.meta.url), "utf8")
]);

test("product cards use a persistent favorite action and quiet rating metadata", () => {
  assert.match(productCard, /customer-product-card__favorite/);
  assert.match(productCard, /useCustomerFavorites/);
  assert.match(productCard, /customer-product-card__rating/);
  assert.doesNotMatch(productCard, /customer-product-rating-badge/);
});

test("customer account exposes favorites as a first-class sibling of order history", () => {
  assert.match(accountPage, /type AccountTab = "orders" \| "favorites" \| "profile" \| "security"/);
  assert.match(accountPage, /Favorites/);
  assert.match(accountPage, /customer-account-favorites-grid/);
});

test("review posting is verified-purchase gated and preserves drafts through sign-in", () => {
  assert.match(productDetail, /ysabelle:review-draft:/);
  assert.match(productDetail, /fetchStorefrontReviewContext/);
  assert.match(productDetail, /Verified purchase/);
  assert.match(storefrontService, /status: CustomerOrderStatus\.COMPLETED/);
  assert.match(storefrontService, /verifiedOrderId/);
  assert.match(storefrontRoutes, /requireCustomerAuth/);
  assert.match(storefrontRoutes, /requireAllowedCustomerAuthOrigin/);
});

test("trending is driven by verified review momentum rather than recent POS sales", () => {
  const merchandisingStart = storefrontService.indexOf(
    "export async function listStorefrontMerchandising"
  );
  const merchandisingEnd = storefrontService.indexOf(
    "export async function getStorefrontProduct",
    merchandisingStart
  );
  const merchandisingSource = storefrontService.slice(merchandisingStart, merchandisingEnd);

  assert.match(merchandisingSource, /productReview\.findMany/);
  assert.match(merchandisingSource, /verifiedOrderId: \{ not: null \}/);
  assert.match(merchandisingSource, /averageRating < TRENDING_MINIMUM_AVERAGE_RATING/);
  assert.doesNotMatch(merchandisingSource, /saleItem\.findMany/);
  assert.match(homePage, /recent verified ratings/);
});

test("favorites and owner moderation have authenticated server routes", () => {
  assert.match(accountRoutes, /\/favorites\/:productId/);
  assert.match(accountRoutes, /requireCustomerAuth/);
  assert.match(moderationRoutes, /requireAuth/);
  assert.match(moderationRoutes, /requireRole\("OWNER"\)/);
});
