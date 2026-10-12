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
  assert.match(css, /\.customer-shop-page \.shop-category-navigation:not\(\.is-expanded\) > a\s*\{\s*display: none;/);
  assert.match(shop, /\[categoriesExpanded, setCategoriesExpanded\] = useState\(false\)/);
  assert.match(shop, /aria-expanded=\{categoriesExpanded\}/);
  assert.match(shop, /className="shop-category-toggle"/);
  assert.match(shop, /setCategoriesExpanded\(\(current\) => !current\)/);
  assert.match(css, /overflow-wrap: anywhere/);
});

test("expanded categories adapt to narrow width without stretching the shop", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const shop = read("frontend/src/pages/customer/ShopPage.tsx");
  const qa = read("tools/mobile-qa/run.mjs");
  const phone = css.split("@media (max-width: 700px) {")[1]?.split("/* On portrait phones")[0];
  assert.ok(phone, "Expected phone category layout overrides");

  assert.match(phone, /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 14rem\), 1fr\)\)/);
  assert.match(phone, /grid-auto-rows: minmax\(44px, auto\)/);
  assert.match(phone, /\.shop-category-navigation\.is-expanded\s*\{[^}]*max-height: min\(48dvh, 20rem\);[^}]*overflow-y: auto;/);
  assert.match(phone, /\.shop-category-navigation > \.shop-category-toggle\s*\{[^}]*position: sticky;[^}]*top: 0;/);
  assert.match(phone, /\.shop-category-navigation > a\s*\{[^}]*min-height: 44px;[^}]*align-self: start;/);
  assert.match(phone, /\.shop-category-navigation > a > small\s*\{[^}]*flex: none;/);
  assert.equal(
    shop.split("onClick={() => setCategoriesExpanded(false)}").length - 1,
    2,
    "Both All Categories and dynamic category links must close the mobile selector"
  );

  assert.match(qa, /async function checkShopCategories\(page, viewport\)/);
  assert.match(qa, /viewport\.width <= 430 && geometry\.columns !== 1/);
  assert.match(qa, /Expanded category panel takes too much vertical space/);
  assert.match(qa, /Expanded category names or counts overflow horizontally/);
  assert.match(qa, /Category picker did not collapse after choosing an option/);
});

test("mobile shop filters keep desktop native select and expose a bounded phone options panel", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const shop = read("frontend/src/pages/customer/ShopPage.tsx");
  const phone = css.split("@media (max-width: 700px) {")[1]?.split("/* On portrait phones")[0];
  assert.ok(phone, "Missing phone controls breakpoint");

  assert.match(phone, /\.customer-shop-page \.shop-category-navigation:not\(\.is-expanded\) > a\s*\{\s*display: none;/);
  assert.match(phone, /\.customer-shop-page \.customer-filter-panel\.shop-category-navigation\s*\{[^}]*border: 0;/);
  assert.match(phone, /\.customer-shop-page \.customer-shop-toolbar\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) 44px;[^}]*padding: 0;[^}]*border: 0;/);
  assert.match(phone, /\.customer-shop-page \.customer-select--availability\s*\{[^}]*width: 44px;[^}]*height: 44px;/);
  assert.match(phone, /\.customer-shop-page \.customer-select--availability \.customer-select__desktop\s*\{\s*display: none;/);
  assert.match(phone, /\.customer-shop-page \.customer-select__mobile-trigger\s*\{[^}]*display: grid;[^}]*min-width: 44px;/);
  assert.match(phone, /\.customer-shop-page \.customer-select__mobile-options\s*\{[^}]*right: 0;[^}]*display: grid;[^}]*width: min\(12rem, calc\(100vw - 32px\)\);/);
  assert.match(phone, /\.customer-shop-page \.customer-select__mobile-options > button\s*\{[^}]*min-height: 44px;/);
  assert.match(phone, /\.customer-shop-page \.customer-shop-search input\s*\{[^}]*background: transparent;[^}]*background-image: none;[^}]*box-shadow: none;/);
  assert.match(phone, /:root\.dark \.customer-app \.customer-shop-page \.customer-shop-search input\s*\{[^}]*background: transparent !important;[^}]*background-image: none !important;/);
  assert.match(phone, /\.customer-shop-page \.customer-results-meta\s*\{[^}]*padding-block: 0\.9rem 0\.7rem;/);
  assert.match(phone, /:root\.dark \.customer-app \.customer-shop-page \.customer-shop-search input/);

  assert.match(shop, /shop-category-toggle__label/);
  assert.match(shop, /activeCategory\?\.name \?\? "Categories"/);
  assert.match(shop, /customer-select--availability/);
  assert.match(shop, /availabilityParam === "all" \? "" : " is-active"/);
  assert.match(shop, /aria-label="Filter products by availability"/);
  assert.match(shop, /onChange=\{\(event\) => applyAvailability\(event\.target\.value as AvailabilityFilter\)\}/);
  assert.match(shop, /<option value="in-stock">In stock<\/option>/);
  assert.match(shop, /<option value="out-of-stock">Out of stock<\/option>/);
  assert.match(shop, /customer-select__active-dot/);
  assert.match(shop, /className="customer-select__desktop"/);
  assert.match(shop, /aria-expanded=\{availabilityOpen\}/);
  assert.match(shop, /function toggleAvailability\(\)/);
  assert.match(shop, /availabilityOpensAbove \? " is-above" : ""/);
  assert.match(phone, /\.customer-shop-page \.customer-select__mobile-options\.is-above\s*\{[^}]*top: auto;[^}]*bottom: calc\(100% \+ 6px\);/);
  assert.match(shop, /role="group"/);
  assert.match(shop, /aria-pressed=\{availabilityParam === value\}/);
  assert.match(shop, /setAvailabilityOpen\(false\)/);
  assert.match(shop, /document\.addEventListener\("pointerdown", closeWhenOutside\)/);
  assert.match(shop, /document\.addEventListener\("keydown", closeOnEscape\)/);
  const qa = read("tools/mobile-qa/run.mjs");
  assert.match(qa, /async function checkShopAvailability\(page, viewport\)/);
  assert.match(qa, /Availability menu extends beyond the mobile viewport/);
  assert.match(qa, /Availability menu is clipped by the screen edge or bottom dock/);
  assert.match(qa, /Search input has a separate rectangular background or shadow/);
  assert.match(qa, /await region\.waitFor\(\{ state: "hidden" \}\)/);
});

test("compact catalog product controls and rail remain accessible in portrait", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const home = read("frontend/src/components/customer/HomeProductRail.tsx");
  const card = read("frontend/src/components/customer/ProductCard.tsx");
  assert.match(css, /\.customer-app \.customer-product-card__purchase-row\s*\{[^}]*grid-template-columns: minmax\(0, 1\.35fr\) minmax\(0, 1fr\);/);
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
  const tokens = read("frontend/src/styles/customer-mobile-tokens.css");
  assert.match(tokens, /--store-phone-gutter: clamp\(12px, 4vw, 16px\)/);
  assert.match(tokens, /--store-phone-card-gap: clamp\(8px, 2\.5vw, 12px\)/);
  assert.match(tokens, /--store-phone-section-gap: clamp\(20px, 6vw, 30px\)/);
  assert.match(portrait, /width: calc\(100% - 2 \* var\(--store-phone-gutter\)\)/);
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
  assert.match(css, /\.customer-app \.customer-product-card__actions \.customer-quantity\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(18px, 0\.85fr\) minmax\(0, 1fr\);/);
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
  assert.match(nav, /<DialogPrimitive\.Content\s+className="customer-mobile-more__sheet"/);
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
  assert.match(css, /max-height: min\(68dvh, 380px\)/);
  assert.match(css, /max-width: 380px/);
  assert.match(css, /border-radius: 1\.15rem/);
  assert.match(css, /--store-mobile-floating-gap, 8px/);
  assert.match(css, /safe-area-inset-bottom/);

  // The legacy duplicate mobile panel is gone; the desktop links remain.
  assert.doesNotMatch(header, /customer-menu-button|customer-mobile-panel|menuOpen/);
  assert.match(header, /aria-label="Customer navigation"/);
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

test("mobile sizing primitives and floating sheet are centralized for browser QA", () => {
  const app = read("frontend/src/app/CustomerApp.tsx");
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const tokens = read("frontend/src/styles/customer-mobile-tokens.css");
  const packageJson = JSON.parse(read("package.json"));
  const qaScript = read("tools/mobile-qa/run.mjs");

  assert.match(
    app,
    /import "@\/styles\/customer-mobile-tokens\.css";\s*import "@\/styles\/customer-adaptive-mobile\.css";/
  );
  assert.match(tokens, /--store-mobile-touch-target: 44px/);
  assert.match(tokens, /--store-mobile-dock-clearance: 76px/);
  assert.match(tokens, /--store-mobile-floating-gap: 8px/);
  assert.match(css, /\.customer-mobile-more__sheet\s*\{[^}]*right: 12px;[^}]*left: 12px;/);
  assert.match(css, /border-bottom: 0;/); // existing dock, not the floating card
  const sheetCss = css.split(".customer-mobile-more__sheet {")[1]?.split(
    ".customer-mobile-more__header {"
  )[0];
  assert.ok(sheetCss);
  assert.match(sheetCss, /border: 1px solid #bcc6e1/);
  assert.doesNotMatch(sheetCss, /border-bottom: 0/);
  assert.match(sheetCss, /@media \(min-width: 701px\), \(orientation: landscape\)/);

  assert.equal(packageJson.scripts["qa:mobile"], "node tools/mobile-qa/run.mjs");
  assert.match(qaScript, /const VIEWPORTS = \[/);
  for (const width of [320, 360, 375, 390, 430, 640, 768, 1280]) {
    assert.match(qaScript, new RegExp(`width: ${width}\\b`));
  }
  assert.match(qaScript, /document\.documentElement\.scrollWidth/);
  assert.match(qaScript, /getByRole\("dialog"\)/);
  assert.match(qaScript, /dockTop - 6/);
});

test("floating More geometry follows the measured dock height, not a fixed pixel guess", () => {
  const nav = read("frontend/src/components/customer/CustomerMobileNav.tsx");
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");

  assert.match(nav, /const dockRef = useRef<HTMLElement>\(null\)/);
  assert.match(nav, /ref=\{dockRef\}/);
  assert.match(nav, /getComputedStyle\(dock\)\.position !== "fixed"/);
  assert.match(nav, /window\.innerHeight - dock\.getBoundingClientRect\(\)\.top/);
  assert.match(nav, /new ResizeObserver\(measure\)/);
  assert.match(nav, /window\.addEventListener\("resize", measure\)/);
  assert.match(nav, /--store-mobile-measured-dock-height/);

  const sheetCss = css.split(".customer-mobile-more__sheet {")[1]?.split(
    "/* Floating More panel keeps physical separation"
  )[0];
  assert.ok(sheetCss);
  assert.match(sheetCss, /var\(--store-mobile-measured-dock-height,/);
  assert.match(sheetCss, /var\(--store-mobile-floating-gap, 8px\)/);
  assert.doesNotMatch(sheetCss, /border-bottom: 0/);
});

test("mobile browser QA bypasses first-visit splash in isolation and waits for route content", () => {
  const qaScript = read("tools/mobile-qa/run.mjs");

  assert.match(qaScript, /await context\.addInitScript\(\(\) => \{/);
  assert.match(qaScript, /window\.sessionStorage\.setItem\("ysabelle-store-entrance-entered", "true"\)/);
  assert.match(qaScript, /\.customer-app\.ys-material-canvas/);
  assert.match(qaScript, /route === "\/" \? "\.customer-home" : "\.customer-shop-page"/);
  assert.match(qaScript, /panelBottom=/);
  assert.match(qaScript, /dockTop=/);
});

test("browser QA permits only clipped carousel items outside viewport on non-portrait screens", () => {
  const qa = read("tools/mobile-qa/run.mjs");

  assert.match(qa, /const portraitPhone = width <= 700 && height > width/);
  assert.match(qa, /function isContainedInHorizontalRail\(element\)/);
  assert.match(qa, /if \(portraitPhone\) return false;/);
  assert.match(qa, /element\.closest\("\.home-product-rail__viewport"\)/);
  assert.match(qa, /\["auto", "scroll"\]\.includes\(railStyle\.overflowX\)/);
  assert.match(qa, /rail\.scrollWidth > rail\.clientWidth \+ 2/);
  assert.match(qa, /railBounds\.left >= -1/);
  assert.match(qa, /railBounds\.right <= width \+ 1/);
  assert.match(qa, /if \(isContainedInHorizontalRail\(element\)\) continue;/);
  assert.match(qa, /horizontalRailsInPortrait/);
  assert.match(qa, /Document overflow:/);
  assert.match(qa, /Horizontal product rails in portrait:/);
  assert.match(qa, /Elements outside viewport:/);
});

test("phone category cards share consistent height, title space, and action", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const home = read("frontend/src/pages/customer/CustomerHomePage.tsx");
  const presentation = read("frontend/src/utils/storefrontCategoryPresentation.ts");
  const qa = read("tools/mobile-qa/run.mjs");

  assert.match(home, /getCustomerCategoryDescription\(category\.description\)/);
  assert.match(home, /className="home-category-card__description"/);
  assert.match(home, /className="home-category-card__mobile-cta"/);
  assert.match(home, /Browse products/);
  assert.match(presentation, /export function getCustomerCategoryDescription\(description: string \| null\)/);
  assert.match(presentation, /reviewed category for source\[- \]mapped\|source\[- \]mapped SARIM/i);
  assert.match(presentation, /return "Explore this aisle"/);

  const portrait = css.split("/* Consistent phone scale: portrait")[1]?.split(
    "/* A wide portrait phone/foldable"
  )[0];
  assert.ok(portrait, "Missing phone portrait category CSS");
  assert.match(portrait, /\.customer-home \.home-category-grid > \.home-reveal--card\s*\{[^}]*height: 100%;/);
  assert.match(portrait, /\.customer-home \.home-category-card__visual\s*\{[^}]*aspect-ratio: 4 \/ 3;/);
  assert.match(portrait, /\.customer-home \.home-category-card__body\s*\{[^}]*min-height: clamp\(88px, 25vw, 96px\);/);
  assert.match(portrait, /\.customer-home \.home-category-card__body strong\s*\{[^}]*-webkit-line-clamp: 3;/);
  assert.match(portrait, /\.customer-home \.home-category-card__description\s*\{\s*display: none;/);
  assert.match(portrait, /\.customer-home \.home-category-card__mobile-cta\s*\{\s*display: inline-flex;/);
  assert.match(css, /:root\.dark \.customer-app \.home-category-card__mobile-cta/);

  assert.match(qa, /\.home-category-grid \.home-category-card/);
  assert.match(qa, /unevenCardHeights/);
  assert.match(qa, /unevenImageHeights/);
  assert.match(qa, /card\.offsetHeight/);
  assert.match(qa, /\?\.offsetHeight \?\? 0/);
  assert.match(qa, /missingBrowsingActions/);
  assert.match(qa, /visibleDescriptions/);
  assert.match(qa, /Category cards have inconsistent heights/);
});

test("mobile global search occupies one header row until explicitly opened", () => {
  const header = read("frontend/src/components/customer/CustomerHeader.tsx");
  const search = read("frontend/src/components/customer/GlobalStorefrontSearch.tsx");
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");

  assert.match(header, /\[mobileSearchOpen, setMobileSearchOpen\] = useState\(false\)/);
  assert.match(header, /customer-mobile-search-trigger/);
  assert.match(header, /aria-expanded=\{mobileSearchOpen\}/);
  assert.match(header, /aria-controls="customer-global-search"/);
  assert.match(header, /is-mobile-open/);
  assert.match(header, /setMobileSearchOpen\(false\)/);
  assert.match(header, /document\.addEventListener\("keydown", dismissOnEscape, true\)/);
  assert.match(header, /document\.removeEventListener\("keydown", dismissOnEscape, true\)/);
  assert.match(header, /mobileSearchTriggerRef\.current\?\.focus\(\)/);
  assert.match(header, /autoFocus=\{mobileSearchOpen\}/);
  assert.match(header, /if \(!mobileSearchOpen\) return;/);
  assert.match(header, /target\.closest\("\.customer-mobile-search-trigger"\)/);
  assert.match(search, /autoFocus = false/);
  assert.match(search, /if \(autoFocus && enabled\) inputRef\.current\?\.focus\(\)/);

  assert.match(css, /\.customer-mobile-search-trigger\s*\{\s*display: none;/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /\.customer-app \.customer-header__search-region\s*\{[^}]*position: absolute;[^}]*display: none;/);
  assert.match(css, /\.customer-app \.customer-header__search-region\.is-mobile-open:not\(\.is-hidden\)/);
  assert.match(css, /\.customer-app \.customer-header__search-region\.is-hidden\s*\{\s*display: none;/);
  assert.match(css, /\.customer-global-search__popup\s*\{[^}]*max-height: min\(19rem, calc\(100dvh - 12rem\)\)/);
  assert.match(css, /\.customer-global-search__list,[\s\S]*?overscroll-behavior-y: contain;/);
});

test("browser QA covers compact search suggestions without covering mobile dock", () => {
  const qa = read("tools/mobile-qa/run.mjs");
  assert.match(qa, /async function checkCompactSearch\(page, viewport\)/);
  assert.match(qa, /headerBounds\.height > 110/);
  assert.match(qa, /Search suggestions too tall/);
  assert.match(qa, /Search suggestions cover the fixed bottom navigation/);
  assert.match(qa, /Global search must be collapsed by default on mobile/);
  assert.match(qa, /route === "\/" && viewport\.width <= 700 && viewport\.height > viewport\.width/);
  assert.match(qa, /await checkCompactSearch\(page, viewport\)/);
  assert.match(qa, /page\.keyboard\.press\("Escape"\)/);
});

test("phone cart scales to multiple products without giant images or stacked quantity", () => {
  const css = read("frontend/src/styles/customer-cart-premium.css");
  const page = read("frontend/src/pages/customer/CartPage.tsx");
  const qa = read("tools/mobile-qa/run.mjs");

  const phone = css.split("/* Sprint 12 mobile cart density.")[1];
  assert.ok(phone, "Compact cart mobile override is missing");
  assert.match(phone, /@media \(max-width: 700px\)/);
  assert.match(phone, /\.customer-cart-item\s*\{[^}]*grid-template-columns: clamp\(76px, 23vw, 100px\) minmax\(0, 1fr\);[^}]*grid-template-rows: auto auto;/);
  assert.match(phone, /\.customer-cart-item > \.customer-product-visual\s*\{[^}]*grid-column: 1;[^}]*grid-row: 1;[^}]*min-height: 0;[^}]*max-height: 100px;/);
  assert.match(phone, /\.customer-cart-item__info\s*\{[^}]*grid-column: 2;[^}]*grid-row: 1;/);
  assert.match(phone, /\.customer-cart-item__quantity\s*\{[^}]*grid-column: 1 \/ -1;[^}]*grid-row: 2;[^}]*grid-template-columns: minmax\(0, 1fr\) max-content;/);
  assert.match(phone, /\.customer-cart-item__quantity \.customer-quantity\s*\{[^}]*height: 44px;/);
  assert.match(phone, /\.customer-cart-item__info button\s*\{[^}]*min-height: 44px;/);
  assert.match(phone, /\.customer-cart-item__quantity > strong\s*\{[^}]*font-variant-numeric: tabular-nums;/);

  assert.match(page, /const CART_PAGE_SIZE = 5;/);
  assert.match(page, /items\.slice\(start, start \+ CART_PAGE_SIZE\)/);
  assert.match(page, /items\.length > CART_PAGE_SIZE/);
  assert.match(page, /className="customer-cart-summary-stack"/);
  assert.match(page, /Remove \$\{product\.name\} from cart/);
  assert.match(page, /onChange=\{\(value\) => updateQuantity\(product\.id, value\)\}/);
  assert.match(page, /formatCurrency\(Number\(product\.sellingPrice\) \* quantity\)/);
  assert.match(page, /formatCurrency\(subtotal\)/);

  assert.match(qa, /async function checkMobileCart\(page, viewport\)/);
  assert.match(qa, /Not enough in-stock products to verify a multi-item cart/);
  assert.match(qa, /Cart line is oversized, clipped, or has unusable actions/);
  assert.match(qa, /Remove cart item did not update list/);
  assert.match(qa, /await checkMobileCart\(page, viewport\)/);
});

test("mobile review ratings fit six filters in a two-row grid without a scroll rail", () => {
  const detail = read("frontend/src/pages/customer/ProductDetailPage.tsx");
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const qa = read("tools/mobile-qa/run.mjs");

  assert.match(detail, /const reviewFilters = \[null, 5, 4, 3, 2, 1\] as const;/);
  assert.match(detail, /aria-label=\{rating === null \? \`All reviews \(\$\{count\}\)\` : \`\$\{rating\}-star reviews \(\$\{count\}\)\`\}/);
  assert.match(detail, /aria-pressed=\{ratingFilter === rating\}/);
  assert.match(detail, /onClick=\{\(\) => onFilterChange\(rating\)\}/);
  assert.match(detail, /customer-review-filter__label-full/);
  assert.match(detail, /customer-review-filter__label-compact/);
  assert.match(css, /\.customer-product-page \.customer-review-filter__label-compact\s*\{\s*display: none;/);

  const phone = css.split("/* Product detail reviews: desktop keeps")[1];
  assert.ok(phone, "Missing scoped mobile review-filter rules");
  assert.match(phone, /@media \(max-width: 520px\)/);
  assert.match(phone, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(phone, /\.customer-product-page \.customer-review-filters\s*\{[^}]*overflow: visible;/);
  assert.match(phone, /\.customer-product-page \.customer-review-filters > button\s*\{[^}]*min-height: 44px;/);
  assert.match(phone, /\.customer-product-page \.customer-review-filter__label-full\s*\{\s*display: none;/);
  assert.match(phone, /\.customer-product-page \.customer-review-filter__label-compact\s*\{\s*display: inline;/);

  assert.match(qa, /Mobile rating filters do not fit the two-row, three-column touch grid/);
  assert.match(qa, /state\.reviewFilterGeometry\.rows !== 2/);
  assert.match(qa, /reviewFilters\.scrollWidth > reviewFilters\.clientWidth \+ 2/);
  assert.match(qa, /getByRole\("button", \{ name: \/5-star reviews\/ \}\)/);
  assert.match(qa, /getByRole\("button", \{ name: \/All reviews\/ \}\)/);
});

test("phone recommendation carousel stays compact while page scrolling works without bars", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const related = read("frontend/src/pages/customer/ProductDetailPage.tsx");
  const qa = read("tools/mobile-qa/run.mjs");
  const styles = css.split("/* Compact related-products carousel and unobtrusive page scrollbars.")[1];
  assert.ok(styles, "Missing scoped phone carousel CSS");

  assert.match(styles, /@media \(max-width: 700px\) and \(orientation: portrait\)/);
  assert.match(styles, /html\[data-appearance-scope="storefront"\][\s\S]*?scrollbar-width: none;/);
  assert.match(styles, /html\[data-appearance-scope="storefront"\]::-webkit-scrollbar/);
  assert.doesNotMatch(styles, /(?:html|body)[^{]*\{[^}]*overflow(?:-y)?: hidden/);
  assert.match(styles, /\.customer-related-products__rail-shell\s*\{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\) 44px 44px minmax\(0, 1fr\);/);
  assert.match(styles, /\.customer-related-products__arrow\s*\{[^}]*position: static;[^}]*display: grid;[^}]*width: 44px;[^}]*height: 44px;/);
  assert.match(styles, /\.customer-related-products__arrow--previous\s*\{[^}]*grid-column: 2;[^}]*grid-row: 2;/);
  assert.match(styles, /\.customer-related-products__arrow--next\s*\{[^}]*grid-column: 3;[^}]*grid-row: 2;/);
  assert.match(styles, /\.customer-related-products__viewport\s*\{[^}]*grid-column: 1 \/ -1;[^}]*grid-row: 1;[^}]*overflow-x: auto;[^}]*scroll-snap-type: x mandatory;/);
  assert.match(styles, /\.customer-related-products__viewport > \.customer-product-card\s*\{[^}]*flex: 0 0 calc\(\(100% - var\(--store-phone-card-gap, 8px\)\) \/ 2\);/);
  assert.match(styles, /\.customer-product-visual\s*\{[^}]*aspect-ratio: 4 \/ 3;/);
  assert.match(styles, /\.customer-product-card__purchase-row\s*\{[^}]*grid-template-columns: minmax\(0, 1\.4fr\) minmax\(0, 1fr\);/);
  assert.match(styles, /\.customer-product-card__cart-button\s*\{[^}]*min-height: 44px;/);
  assert.match(styles, /\.customer-product-card__add-mobile\s*\{\s*display: inline;/);

  assert.match(related, /className="customer-related-products__viewport" ref=\{railRef\}/);
  assert.match(related, /behavior: "smooth"/);
  assert.match(qa, /Related-product carousel cards are oversized, clipped or not swipeable/);
  assert.match(qa, /Related-product arrows overlap cards or fall outside their navigation row/);
  assert.match(qa, /arrow\.top >= relatedBounds\.bottom \+ 1/);
  assert.match(qa, /arrow\.width >= 43 && arrow\.height >= 43/);
  assert.match(qa, /getComputedStyle\(button\)\.position === "static"/);
  assert.match(qa, /Mobile storefront still shows a persistent document scrollbar/);
  assert.match(qa, /state\.relatedLayout\.count >= 2/);
});

test("mobile product detail keeps sizes readable and explains verified-review eligibility", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const sizes = read("frontend/src/components/customer/ProductSizeSelector.tsx");
  const detail = read("frontend/src/pages/customer/ProductDetailPage.tsx");
  const service = read("backend/src/services/storefrontService.ts");

  assert.match(css, /\.customer-product-page \.customer-product-visual\.customer-product-visual--large\s*\{[^}]*height: clamp\(260px, 82vw, 340px\);[^}]*min-height: 0;/);
  assert.match(css, /\.customer-product-page \.customer-product-size-selector__rail-shell\s*\{[^}]*display: block;/);
  assert.match(css, /\.customer-product-page \.customer-product-size-selector__arrow\s*\{\s*display: none;/);
  assert.match(css, /\.customer-product-page \.customer-product-size-option\s*\{[^}]*flex: 0 0 calc\(\(100% - 0\.55rem\) \/ 2\);/);
  assert.match(css, /\.customer-product-page \.customer-product-size-option__copy strong\s*\{[^}]*white-space: normal;/);
  assert.match(css, /\.customer-product-page \.customer-product-size-option\s*\{[^}]*grid-template-rows: 100px minmax\(0, auto\);/);
  assert.match(css, /\.customer-product-page \.customer-product-size-option__visual\s*\{[^}]*height: 100%;[^}]*overflow: hidden;/);
  assert.match(css, /\.customer-product-page \.customer-product-size-option__image > img\s*\{[^}]*object-fit: contain;/);
  assert.match(css, /\.customer-product-page \.customer-product-size-option__image\[data-image-resolution="low"\] > img\s*\{[^}]*max-height: min\(90%, var\(--catalog-image-natural-height\)\);[^}]*object-fit: contain;/);
  assert.match(sizes, /customer-product-size-selector__swipe-hint/);
  assert.doesNotMatch(sizes, /title=\{variant\.name\}/);

  assert.match(detail, /reviewContextLoading/);
  assert.match(detail, /"Purchase required"/);
  assert.match(detail, /Signed in · Purchase not verified/);
  assert.match(detail, /Check order history/);
  assert.match(detail, /Retry verification/);
  assert.match(detail, /writeReviewDraft\(productId, \{ rating: star, comment: reviewComment \}\)/);
  assert.match(detail, /authStatus === "authenticated" && !reviewContext\?\.eligible/);
  assert.match(service, /status: CustomerOrderStatus\.COMPLETED,/);
  assert.match(service, /items: \{ some: \{ productId \} \}/);
  assert.match(service, /code: "CUSTOMER_REVIEW_PURCHASE_REQUIRED"/);

  const qa = read("tools/mobile-qa/run.mjs");
  assert.match(qa, /async function checkMobileProductDetail\(page, viewport\)/);
  assert.match(qa, /Mobile detail image has incorrect height/);
  assert.match(qa, /Pack-size controls have obstructive tooltips or clipped labels/);
  assert.match(qa, /Pack-size product thumbnails are clipped or too short for full images/);
  assert.match(qa, /imageBounds\.bottom > frame\.bottom \+ 1/);
  assert.match(qa, /Product detail review form is missing/);
});

test("small-phone product cards retain semantics with compact badges and Add", () => {
  const card = read("frontend/src/components/customer/ProductCard.tsx");
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");

  assert.match(card, /customer-product-badge__label-full/);
  assert.match(card, /customer-product-badge__label-mobile/);
  assert.match(card, /resolvedBadge\.tone === "trending"/);
  assert.match(card, /resolvedBadge\.tone === "best-seller"/);
  assert.match(card, /customer-product-card__review-count/);
  assert.match(card, /customer-product-card__add-full/);
  assert.match(card, /customer-product-card__add-mobile/);
  assert.match(card, /Add \$\{selectedQuantity\} \$\{product\.name\} to cart/);
  assert.match(card, /addItem\(product, selectedQuantity\)/);
  assert.match(card, /toggleFavorite\(product\.id\)/);
  assert.match(card, /onChange=\{handleQuantityChange\}/);
  assert.match(card, /disabled=\{!isReady\}/);

  const portrait = css.split("/* Consistent phone scale: portrait")[1]?.split(
    "/* A wide portrait phone/foldable"
  )[0];
  assert.ok(portrait, "Missing portrait product rules");
  assert.match(css, /\.customer-product-badge__label-mobile,[\s\S]*?\.customer-product-card__add-mobile,[\s\S]*?\.customer-shop-page \.customer-select__mobile-trigger,[\s\S]*?\.customer-shop-page \.customer-select__mobile-options\s*\{\s*display: none;/);
  assert.match(portrait, /\.customer-app \.customer-product-badge\s*\{[^}]*max-width: calc\(100% - 60px\);/);
  assert.match(portrait, /\.customer-app \.customer-product-badge__label-full\s*\{\s*display: none;/);
  assert.match(portrait, /\.customer-app \.customer-product-badge__label-mobile\s*\{\s*display: block;/);
  assert.match(portrait, /\.customer-app \.customer-product-card__favorite\s*\{[^}]*width: 44px;[^}]*height: 44px;/);
  assert.match(portrait, /\.customer-app \.customer-product-card__favorite::before\s*\{[^}]*inset: 5px;/);
  assert.match(portrait, /\.customer-app \.customer-product-card h3\s*\{[^}]*-webkit-line-clamp: 2;/);
  assert.match(portrait, /\.customer-app \.customer-product-card__rating \.customer-product-card__review-count\s*\{\s*display: none;/);
  assert.match(portrait, /\.customer-app \.customer-product-card__actions \.customer-quantity\s*\{[^}]*height: 44px;/);
  assert.match(portrait, /\.customer-app \.customer-product-card__cart-button\s*\{[^}]*width: 100%;/);
  assert.match(portrait, /\.customer-app \.customer-product-card__add-full\s*\{\s*display: none;/);
  assert.match(portrait, /\.customer-app \.customer-product-card__add-mobile\s*\{\s*display: inline;/);
  assert.match(portrait, /:root\.dark \.customer-app \.customer-product-card__favorite::before/);
});

test("browser QA checks actual product badge collision and reachable mobile cart controls", () => {
  const qa = read("tools/mobile-qa/run.mjs");

  assert.match(qa, /const productCards = portraitPhone/);
  assert.match(qa, /\.customer-product-badge__label-mobile/);
  assert.match(qa, /badgeBounds\.right > favoriteBounds\.left - 1/);
  assert.match(qa, /getComputedStyle\(title\)\.webkitLineClamp !== "2"/);
  assert.match(qa, /favoriteBounds|bounds\.width < 43 \|\| bounds\.height < 43/);
  assert.match(qa, /if \(add && !add\.disabled\)/);
  assert.match(qa, /bounds\.width > 97 \|\| bounds\.height > 48 \|\| bounds\.height < 43/);
  assert.match(qa, /Overlapping product badge and favorite/);
  assert.match(qa, /Clipped or hidden mobile badge label/);
  assert.match(qa, /Favorite touch target below 44px/);
  assert.match(qa, /Cart action outside compact 44px sizing/);
  assert.match(qa, /Quantity controls below 24px wide or 44px tall/);
  assert.match(qa, /Mobile review counts still visible/);
  assert.match(qa, /Product titles not clamped to two lines/);
  assert.match(qa, /\.customer-product-card"\)\.first\(\)\.waitFor/);
});

test("checkout confirmation keeps readable mobile spacing without changing payment consent", () => {
  const css = read("frontend/src/styles/customer-adaptive-mobile.css");
  const policyCss = read("frontend/src/styles/customer-order-policy.css");
  const checkout = read("frontend/src/pages/customer/CheckoutPage.tsx");
  const qa = read("tools/mobile-qa/run.mjs");
  const block = css.split("/* Sprint 12: breathe between checkout explanation")[1];
  assert.ok(block, "Missing checkout confirmation phone-spacing override");

  assert.match(block, /@media \(max-width: 700px\)/);
  assert.match(block, /\.customer-checkout-summary\s*\{[^}]*padding: clamp\(1rem, 4vw, 1\.3rem\);/);
  assert.match(block, /\.customer-checkout-summary > \.customer-checkout-policy-group\s*\{[^}]*gap: 1rem;/);
  assert.match(block, /\.customer-checkout-policy-group > \.customer-order-summary__helper\s*\{[^}]*line-height: 1\.65 !important;/);
  assert.match(policyCss, /\.customer-checkout-summary > \.customer-checkout-policy-group\s*\{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*gap: 1rem;/);
  assert.match(policyCss, /\.customer-checkout-policy-group > \.customer-order-summary__helper\s*\{[^}]*margin: 0 !important;[^}]*padding: 0 !important;/);
  assert.match(policyCss, /\.customer-checkout-policy-group > \.customer-order-policy__trigger\s*\{[^}]*display: inline-flex;/);
  assert.doesNotMatch(block, /\.customer-checkout-summary > \.customer-order-policy__trigger/);
  assert.match(block, /\.customer-checkout-summary > \.customer-order-agreement\s*\{[^}]*margin-top: 1rem;[^}]*padding: 1rem 0\.9rem;/);
  assert.match(block, /\.customer-checkout-summary > \.customer-order-summary__action\s*\{[^}]*min-height: 48px;[^}]*margin-top: 1\.15rem;/);

  const group = checkout.indexOf('className="customer-checkout-policy-group"');
  const helper = checkout.indexOf('className="customer-order-summary__helper"', group);
  const policy = checkout.indexOf("<CustomerOrderPolicyInfo />", helper);
  const groupClose = checkout.indexOf("</div>", policy);
  const consent = checkout.indexOf('className="customer-order-agreement"', groupClose);
  const payment = checkout.indexOf("customer-order-summary__action", consent);
  assert.ok(group >= 0 && group < helper && helper < policy && policy < groupClose && groupClose < consent && consent < payment);
  assert.match(qa, /async function checkCheckoutPolicySpacing\(page, viewport\)/);
  assert.match(qa, /Checkout delivery text and policy button gap is too small/);
  assert.match(checkout, /checked=\{orderPolicyAccepted\}/);
  assert.match(checkout, /required\s+type="checkbox"/);
  assert.match(checkout, /Continue to PayMongo/);
});
