import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("mobile navigation uses existing storefront routes and cart/auth state", () => {
  const layout = read("frontend/src/layouts/CustomerLayout.tsx");
  const nav = read("frontend/src/components/customer/CustomerMobileNav.tsx");
  const app = read("frontend/src/app/CustomerApp.tsx");
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");

  assert.match(layout, /<CustomerMobileNav navigate=\{navigate\} onStartGuide=\{startGuide\} pathname=\{pathname\} \/>/);
  assert.match(nav, /aria-label="Mobile storefront navigation"/);
  assert.match(nav, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(nav, /useCustomerAuth\(\)/);
  assert.match(nav, /useCart\(\)/);
  for (const path of ['href: "/"', 'href: "/shop"', 'href: "/cart"']) {
    assert.ok(nav.includes(path), "Missing route " + path);
  }
  assert.match(nav, /status === "authenticated" \? "\/account" : "\/login"/);
  assert.match(nav, /itemCount > 99 \? "99\+" : itemCount/);
  assert.match(css, /\.customer-mobile-dock,\s*\.shop-category-toggle\s*\{\s*display: none;/);
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 700px\) and \(orientation: portrait\)/);
  assert.match(css, /@media \(max-width: 950px\) and \(max-height: 500px\) and \(orientation: landscape\)/);
  assert.match(css, /:root\.dark \.customer-app \.customer-mobile-dock/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /:focus-visible/);
  assert.match(app, /import "@\/styles\/customer-adaptive-mobile\.css";/);
  assert.ok(
    app.indexOf('import "@/styles/customer-adaptive-mobile.css";') >
      app.indexOf('import "@/styles/theme-storefront-contrast.css";'),
    "Adaptive overrides must load after existing theme styles"
  );
});

test("mobile categories form an adaptive grid instead of a sideways carousel", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const shop = read("frontend/src/pages/customer/ShopPage.tsx");
  assert.match(css, /\.customer-home \.home-category-grid\s*\{\s*display: grid;/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /scroll-snap-type: none/);
  assert.match(css, /aspect-ratio: 4 \/ 3/);
  assert.match(css, /\.customer-shop-page \.customer-filter-panel\.shop-category-navigation\s*\{\s*display: grid;/);
  assert.match(css, /\.shop-category-navigation:not\(\.is-expanded\) > a:not\(\.is-active\):not\(:first-of-type\)/);
  assert.match(shop, /\[categoriesExpanded, setCategoriesExpanded\] = useState\(false\)/);
  assert.match(shop, /aria-expanded=\{categoriesExpanded\}/);
  assert.match(shop, /className="shop-category-toggle"/);
  assert.match(shop, /setCategoriesExpanded\(\(current\) => !current\)/);
  assert.match(css, /overflow-wrap: anywhere/);
});

test("compact catalog product controls and rail remain accessible in portrait", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const home = read("frontend/src/components/customer/HomeProductRail.tsx");
  const card = read("frontend/src/components/customer/ProductCard.tsx");
  assert.match(css, /\.customer-app \.customer-product-card__purchase-row\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /\.customer-home \.home-product-rail__item\s*\{\s*flex: 0 0 calc\(\(100% - var\(--home-product-rail-gap\)\) \/ 2\);/);
  assert.match(css, /\.customer-shop-page \.shop-product-grid,/);
  assert.match(home, /aria-label=\{`Previous \$\{label\}`\}/);
  assert.match(home, /aria-label=\{`Next \$\{label\}`\}/);
  assert.match(card, /label=\{`Quantity for \$\{product\.name\}`\}/);
  assert.match(card, /disabled=\{!isReady\}/);
});

test("phone portrait uses one sizing system and never enables horizontal product rails", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const portrait = css.split("/* Consistent phone scale: portrait")[1]?.split(
    "/* A wide portrait phone/foldable"
  )[0];
  assert.ok(portrait, "Missing portrait sizing contract");
  assert.match(portrait, /@media \(max-width: 700px\) and \(orientation: portrait\)/);
  assert.match(portrait, /--store-phone-gutter: clamp\(12px, 4vw, 16px\)/);
  assert.match(portrait, /--store-phone-card-gap: clamp\(8px, 2\.5vw, 12px\)/);
  assert.match(portrait, /--store-phone-section-gap: clamp\(20px, 6vw, 30px\)/);
  assert.match(portrait, /\.customer-home \.home-product-rail__viewport\s*\{[^}]*overflow: visible;/);
  assert.match(portrait, /\.customer-home \.home-product-rail__track\s*\{\s*display: grid;/);
  assert.match(portrait, /\.customer-home \.home-product-rail__control,[\s\S]*?display: none;/);
  assert.match(portrait, /scroll-snap-type: none;/);
  assert.match(portrait, /aspect-ratio: 4 \/ 3;/);
  assert.match(portrait, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(portrait, /\.customer-shop-page\s*\{\s*overflow-x: clip;/);
  assert.match(portrait, /\.customer-home \.home-next-step h2\s*\{[^}]*font-size: clamp\(1\.55rem, 6vw, 2\.1rem\)/);
  assert.match(portrait, /\.customer-home \.home-next-step__visual\s*\{[^}]*height: clamp\(11rem, 48vw, 15rem\)/);
  assert.doesNotMatch(portrait, /overflow-x:\s*auto/);
});

test("mobile component sizes reflow at phone and wide-portrait breakpoints", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  assert.match(css, /@media \(min-width: 600px\) and \(max-width: 700px\) and \(orientation: portrait\)/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 359px\) and \(orientation: portrait\)/);
  assert.match(css, /\.customer-app \.customer-product-card__actions \.customer-quantity\s*\{[^}]*grid-template-columns: 44px minmax\(0, 1fr\) 44px;/);
  assert.match(css, /\.customer-app \.customer-product-card__cart-button\s*\{[^}]*font-size: clamp/);
});

test("the five-slot mobile dock has a centered accessible expandable More menu", () => {
  const nav = read("frontend/src/components/customer/CustomerMobileNav.tsx");
  const header = read("frontend/src/components/customer/CustomerHeader.tsx");
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");

  assert.match(nav, /links\.slice\(0, 2\)\.map\(renderLink\)/);
  assert.match(nav, /links\.slice\(2\)\.map\(renderLink\)/);
  assert.match(nav, /<DialogPrimitive\.Root onOpenChange=\{setMoreOpen\} open=\{moreOpen\}>/);
  assert.match(nav, /<DialogPrimitive\.Trigger asChild>/);
  assert.match(nav, /aria-expanded=\{moreOpen\}/);
  assert.match(nav, /aria-label=\{moreOpen \? "Close more options" : "Open more options"\}/);
  assert.match(nav, /<DialogPrimitive\.Overlay className="customer-mobile-more__overlay" \/>/);
  assert.match(nav, /<DialogPrimitive\.Content className="customer-mobile-more__sheet">/);
  assert.match(nav, /<DialogPrimitive\.Title/);
  assert.match(nav, /<DialogPrimitive\.Description/);
  assert.match(nav, /<DialogPrimitive\.Close asChild>/);
  for (const href of ['href="/about"', 'href="/support"']) {
    assert.ok(nav.includes(href), "Missing More destination " + href);
  }
  assert.match(nav, /onStartGuide\(\)/);
  assert.match(nav, /setMoreOpen\(false\)/);

  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.customer-app \.customer-menu-button,[\s\S]*?\.customer-app \.customer-cart-link\s*\{\s*display: none;/);
  assert.match(css, /\.customer-mobile-dock__more-icon\s*\{[^}]*width: 44px;[^}]*height: 44px;/);
  assert.match(css, /\.customer-mobile-more__sheet\s*\{[^}]*position: fixed;/);
  assert.match(css, /max-height: min\(75dvh, 460px\)/);
  assert.match(css, /safe-area-inset-bottom/);

  // The desktop menu is preserved for larger screens, not deleted globally.
  assert.match(header, /className="customer-menu-button"/);
  assert.match(css, /@media \(max-width: 1180px\)/);
});

test("320px portrait constrains the actual header and navbar, not just scrollbar paint", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");

  assert.match(css, /html\[data-appearance-scope="storefront"\] body/);
  assert.match(css, /html\[data-appearance-scope="storefront"\] #root/);
  assert.match(css, /\.customer-app \.customer-header__bar\s*\{[^}]*width: calc\(100% - 2 \* var\(--store-phone-gutter, 12px\)\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(css, /\.customer-app\.ys-material-canvas > \.customer-mobile-dock\s*\{[^}]*box-sizing: border-box;/);
  assert.match(css, /\.customer-app\.ys-material-canvas > \.customer-mobile-dock\s*\{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
});
