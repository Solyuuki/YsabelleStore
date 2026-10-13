import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("storefront and retail keep independent persisted appearance preferences", () => {
  const context = read("frontend/src/context/AppearanceContext.tsx");

  assert.match(context, /ysabellestore\.appearance\.storefront\.v1/);
  assert.match(context, /ysabellestore\.appearance\.retail\.v1/);
  assert.match(context, /getAppearanceScope/);
  assert.match(context, /window\.localStorage\.setItem/);
  assert.match(context, /root\.classList\.toggle\("dark", dark\)/);
});

test("the About scenes and receipt print routes are excluded from dark rendering", () => {
  const context = read("frontend/src/context/AppearanceContext.tsx");
  const bootstrap = read("frontend/index.html");
  const storefrontStyles = read("frontend/src/styles/theme-storefront.css");

  assert.match(context, /pathname === "\/about" \|\| pathname === "\/discover"/);
  assert.match(context, /get\("print"\) === "receipt"/);
  assert.match(bootstrap, /const safeRoute\s*=/);
  assert.ok(bootstrap.includes('path === "/about"'));
  assert.ok(bootstrap.includes('path === "/discover"'));
  assert.doesNotMatch(storefrontStyles, /\.about-experience|\.discover-story|\.story-welcome/);
});

test("both appearance controls and theme styles are loaded without changing Light Mode", () => {
  const header = read("frontend/src/components/customer/CustomerHeader.tsx");
  const settings = read("frontend/src/pages/SettingsPage.tsx");
  const customer = read("frontend/src/app/CustomerApp.tsx");
  const main = read("frontend/src/main.tsx");
  const retail = read("frontend/src/styles/theme-retail.css");
  const storefront = read("frontend/src/styles/theme-storefront.css");

  assert.match(header, /className="customer-theme-toggle"/);
  assert.match(header, /aria-pressed=\{storefrontTheme === "dark"\}/);
  assert.match(settings, /className="ys-appearance-options"/);
  assert.match(settings, /setRetailTheme\("dark"\)/);
  assert.match(customer, /@\/styles\/theme-storefront\.css/);
  assert.match(main, /@\/styles\/theme-retail\.css/);
  assert.match(retail, /:root\.dark \.app-shell-ambient/);
  assert.match(storefront, /:root\.dark \.customer-app/);
  assert.ok(storefront.includes("ys-dark-graphite-glass.svg"));
  assert.ok(customer.includes("@/styles/theme-storefront-contrast.css"));
});

test("dark home category portal and SVG merchandising canvas never reuse light fills", () => {
  const dark = read("frontend/src/styles/theme-storefront.css");
  const home = read("frontend/src/styles/customer-home-premium.css");
  const about = read("frontend/src/pages/customer/AboutExperiencePage.tsx");

  assert.match(home, /\.home-categories__center-light/);
  assert.match(home, /--merch-bg-top:/);
  assert.match(dark, /:root\.dark \.customer-app \.home-categories \{/);
  assert.match(dark, /:root\.dark \.customer-app \.home-categories__center-light/);
  assert.match(dark, /:root\.dark \.customer-app \.home-categories__handoff > path:nth-child\(2\)/);
  assert.match(dark, /:root\.dark \.customer-app \.home-category-merch-handoff/);
  assert.match(dark, /--merch-bg-top: #17243c/);
  assert.match(dark, /\.home-categories \.home-category-card__body small/);
  assert.doesNotMatch(dark, /\.about-experience|\.discover-story|\.story-welcome/);
  assert.match(about, /const storyTheme/);
});

test("dedicated dark asset files exist and are referenced by scoped theme styles", () => {
  const storefront = read("frontend/src/styles/theme-storefront.css");
  const retail = read("frontend/src/styles/theme-retail.css");
  const assets = [
    ["frontend/public/textures/ys-dark-midnight-velvet.svg", "ys-dark-midnight-velvet.svg"],
    ["frontend/public/textures/ys-dark-graphite-glass.svg", "ys-dark-graphite-glass.svg"],
    ["frontend/public/textures/ys-dark-indigo-silk.svg", "ys-dark-indigo-silk.svg"]
  ];

  for (const [path, name] of assets) {
    const svg = read(path);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /preserveAspectRatio="xMidYMid slice"/);
    assert.match(svg, /<\/svg>\s*$/);
    assert.ok(storefront.includes(name) || retail.includes(name), `Unused dark asset: ${name}`);
  }
  assert.doesNotMatch(storefront, /kpi-card-frosted-ribbon\.webp/);
  assert.doesNotMatch(retail, /kpi-card-frosted-ribbon\.webp/);
});

test("dark closing portal preserves inline SVG proportions and its footer handoff", () => {
  const home = read("frontend/src/pages/customer/CustomerHomePage.tsx");
  const storefront = read("frontend/src/styles/theme-storefront.css");

  assert.match(home, /className="home-next-step__dark-backdrop-svg"/);
  assert.match(home, /preserveAspectRatio="xMaxYMid meet"\s+viewBox="0 0 1983 793"/);
  assert.match(storefront, /aspect-ratio: 1983 \/ 793;/);
  assert.match(storefront, /height: auto;/);
  assert.match(storefront, /\.customer-home \.home-next-step::after \{/);
  assert.match(storefront, /\.customer-footer \{/);
});

test("contrast layer uses semantic dark surfaces and is not applied to About", () => {
  const contrast = read("frontend/src/styles/theme-storefront-contrast.css");
  const app = read("frontend/src/app/CustomerApp.tsx");
  assert.match(app, /@\/styles\/theme-storefront-contrast\.css/);
  assert.match(contrast, /--store-contrast-ink: #d4deec/);
  assert.match(contrast, /--store-contrast-stroke: #687995/);
  assert.match(contrast, /customer-review-overview/);
  assert.match(contrast, /customer-account-history-card/);
  assert.match(contrast, /customer-auth-stage__panel/);
  assert.doesNotMatch(contrast, /\.about-experience|\.discover-story|\.story-welcome/);
});

test("printed receipts remain explicitly light", () => {
  const context = read("frontend/src/context/AppearanceContext.tsx");
  const print = read("frontend/src/styles/receipt.css");

  assert.match(context, /isReceiptPrint/);
  assert.match(print, /@media print/);
  assert.match(print, /background: #ffffff !important/);
});

test("logout confirmation reuses the About galaxy and keeps both themes readable", () => {
  const modal = read("frontend/src/components/shared/LogoutConfirmationModal.tsx");
  const darkStyles = read("frontend/src/styles/logout-confirmation.css");
  const theme = read("frontend/src/styles/theme-retail.css");

  assert.match(modal, /@\/styles\/logout-confirmation\.css/);
  assert.match(theme, /--storefront-galaxy-background:/);
  assert.match(darkStyles, /:root\.dark \.logout-confirmation-backdrop/);
  assert.match(darkStyles, /background-image: var\(--storefront-galaxy-background\)/);
  assert.match(darkStyles, /background-size: 72px 72px/);

  for (const part of [
    "panel",
    "header",
    "warning",
    "title",
    "description",
    "notice",
    "actions",
    "cancel"
  ]) {
    assert.ok(
      modal.includes(`logout-confirmation-${part}`),
      `Missing logout component target: ${part}`
    );
    assert.ok(
      darkStyles.includes(`.logout-confirmation-${part}`),
      `Missing scoped dark-mode contrast: ${part}`
    );
  }

  // Light-mode utility styles and the original session controls remain intact.
  assert.match(modal, /bg-white\/95/);
  assert.match(modal, /bg-indigo-50\/80/);
  assert.match(modal, /onClick=\{onCancel\}/);
  assert.match(modal, /onClick=\{onConfirm\}/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /isLoggingOut \? "Securing session\.\.\."/);
});


test("About dark preference themes mobile dock and portaled menus without changing story scenes", () => {
  const appearance = read("frontend/src/context/AppearanceContext.tsx");
  const mobile = read("frontend/src/styles/customer-adaptive-mobile.css");
  const app = read("frontend/src/app/CustomerApp.tsx");
  const scoped = mobile.split("/* About/Discover chrome-only dark mode:")[1];

  assert.ok(scoped, "Missing About-specific mobile chrome styles");
  assert.match(appearance, /root\.dataset\.aboutChromeTheme = "dark"/);
  assert.match(appearance, /!preserveAbout &&/);
  assert.match(app, /customer-adaptive-mobile\.css/);
  assert.match(scoped, /@media \(max-width: 1180px\)/);
  for (const className of [
    "customer-mobile-dock",
    "customer-mobile-dock__link",
    "customer-mobile-dock__more",
    "customer-mobile-dock__more-icon",
    "customer-mobile-more__sheet",
    "customer-mobile-account__popover"
  ]) {
    assert.ok(scoped.includes(className), "Missing About dark style: " + className);
  }
  assert.match(scoped, /:root\[data-about-chrome-theme="dark"\]/);
  assert.match(scoped, /background: rgb\(20 31 49 \/ 96%\)/);
  assert.match(scoped, /color: #d4e0f3;/);
  assert.match(scoped, /:focus-visible/);
  assert.doesNotMatch(scoped, /\.discover-story|\.story-welcome|\.story-catalog/);
  assert.doesNotMatch(scoped, /:root\.light/);
});

test("staff sidebar has an icon-only persisted appearance toggle in expanded and collapsed layouts", () => {
  const sidebar = read("frontend/src/components/app/AppSidebar.tsx");
  const theme = read("frontend/src/styles/theme-retail.css");
  const appearance = read("frontend/src/context/AppearanceContext.tsx");
  const mobile = read("frontend/src/components/app/RetailMobileNavigation.tsx");

  assert.match(sidebar, /import \{ ChevronLeft, LogOut, Moon, Sun \} from "lucide-react";/);
  assert.match(sidebar, /useAppearance\(\)/);
  assert.match(sidebar, /user\?\.role === "STAFF" \? \(/);
  assert.match(sidebar, /className="ys-staff-sidebar-theme-toggle/);
  assert.match(sidebar, /aria-label=\{\`Switch to \$\{retailTheme === "dark" \? "light" : "dark"\} mode\`\}/);
  assert.match(sidebar, /aria-pressed=\{retailTheme === "dark"\}/);
  assert.match(sidebar, /setRetailTheme\(retailTheme === "dark" \? "light" : "dark"\)/);
  assert.match(sidebar, /collapsed \? "justify-center" : "justify-between"/);
  assert.match(sidebar, /<Sun aria-hidden="true"/);
  assert.match(sidebar, /<Moon aria-hidden="true"/);
  assert.match(theme, /:root\.dark \.app-shell-ambient > aside \.ys-staff-sidebar-theme-toggle/);
  assert.match(theme, /\.ys-staff-sidebar-theme-toggle:focus-visible/);
  assert.match(appearance, /ysabellestore\.appearance\.retail\.v1/);
  assert.match(mobile, /setRetailTheme\(retailTheme === "dark" \? "light" : "dark"\)/);
});
