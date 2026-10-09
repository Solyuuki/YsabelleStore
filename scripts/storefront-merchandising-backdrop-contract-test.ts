import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cssPath = resolve(process.cwd(), "src/styles/customer-home-premium.css");
const homePath = resolve(process.cwd(), "src/pages/customer/CustomerHomePage.tsx");

const css = readFileSync(cssPath, "utf8");
const home = readFileSync(homePath, "utf8");

assert.doesNotMatch(
  css,
  /shop-category-background\.webp|storefront-merchandising-background\.webp|home-next-step-background\.(?:avif|webp)/,
  "Storefront home sections must not depend on photographic background assets."
);

assert.match(
  css,
  /\.customer-home\s*\{[\s\S]*?linear-gradient\(145deg, #f4f6fb 0%, #f1f0f8 50%, #f7f2f6 100%\)/,
  "Storefront home must use the Shop/Catalog canvas."
);

assert.match(
  css,
  /\.home-categories\s*\{[\s\S]*?--retail-bg-a:\s*#edf8ff[\s\S]*?--category-portal-blue:\s*#7fc7ff[\s\S]*?--category-portal-violet:\s*#c89cff[\s\S]*?linear-gradient\([\s\S]*?var\(--retail-bg-a\)[\s\S]*?var\(--retail-bg-c\)/,
  "Shop by Category must use the cold showroom-portal palette."
);

assert.doesNotMatch(
  css,
  /\.home-categories::(?:before|after)\s*\{/,
  "Shop by Category must not use decorative pseudo-element patterns."
);

const homeCategoriesRule = css.match(/\.home-categories\s*\{[^}]*\}/s)?.[0] ?? "";
assert.doesNotMatch(
  homeCategoriesRule,
  /repeating-linear-gradient|url\(["']?\//,
  "Shop by Category must remain pattern-free and independent of raster backgrounds."
);

assert.match(
  home,
  /<CategoryRetailBackdrop \/>/,
  "Shop by Category must render the responsive vector showroom ambience."
);

assert.match(
  home,
  /function CategoryRetailBackdrop\(\)[\s\S]*?aria-hidden="true"[\s\S]*?viewBox="0 0 1600 900"[\s\S]*?home-categories__portal-ceiling[\s\S]*?home-categories__portal-side--left[\s\S]*?home-categories__portal-side--right[\s\S]*?home-categories__handoff/,
  "Category backdrop must use architectural portal framing and a merchandising handoff wave."
);

assert.doesNotMatch(
  home,
  /function CategoryRetailBackdrop\(\)[\s\S]*?home-categories__(?:products|podiums|leaves|shelf)/,
  "Category showroom backdrop must not restore literal retail-object silhouettes."
);

assert.match(
  css,
  /\.home-categories__portal-scene\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*100%/,
  "Category portal scene must scale with the entire section."
);

assert.match(
  css,
  /@media \(max-width: 700px\)[\s\S]*?\.home-categories__portal-ceiling[\s\S]*?opacity:\s*0\.42[\s\S]*?\.home-categories__portal-side[\s\S]*?opacity:\s*0\.38/,
  "Category portal must simplify its architecture on small screens."
);

assert.match(
  css,
  /\.home-merchandising-stage\s*\{[\s\S]*?background:\s*transparent/,
  "Outer merchandising stage must stay neutral so the CTA can remain separate."
);

assert.match(
  home,
  /<div aria-hidden="true" className="home-category-merch-handoff" \/>/,
  "Category and merchandising sections must render an explicit decorative transition bridge."
);

assert.match(
  css,
  /\.home-category-merch-handoff\s*\{[\s\S]*?margin-top:\s*calc\(-1 \* clamp\([\s\S]*?margin-bottom:\s*calc\(-1 \* clamp\([\s\S]*?linear-gradient\([\s\S]*?#eef7ff 100%/,
  "Category-to-merchandising bridge must overlap both sections and crossfade into the merchandising top color."
);

assert.match(
  css,
  /\.home-category-merch-handoff::after[\s\S]*?#eef7ff 100%/,
  "Transition bridge must finish with the exact merchandising top color to prevent a visible seam."
);

assert.match(
  css,
  /\.home-merchandising-canvas\s*\{[\s\S]*?--merch-bg-top:\s*#eef7ff[\s\S]*?--merch-wave-blue:\s*#7fc7ff[\s\S]*?--merch-wave-violet:\s*#c89cff[\s\S]*?background:\s*var\(--merch-bg-mid\)/,
  "Trending through Everyday Essentials must share the cold vertical merchandising canvas."
);

assert.match(
  home,
  /<MerchandisingBackdrop \/>/,
  "Merchandising canvas must render the dedicated decorative backdrop."
);

assert.match(
  home,
  /function MerchandisingBackdrop\(\)[\s\S]*?aria-hidden="true"[\s\S]*?viewBox="0 0 1600 2400"[\s\S]*?home-merchandising-canvas__waves--top[\s\S]*?home-merchandising-canvas__waves--bottom/,
  "Merchandising backdrop must be a tall, full-height vector scene with top and bottom wave zones."
);

assert.match(
  css,
  /\.home-merchandising-canvas__backdrop\s*\{[\s\S]*?position:\s*absolute[\s\S]*?inset:\s*0[\s\S]*?pointer-events:\s*none/,
  "Merchandising vector backdrop must stay decorative and non-interactive."
);

assert.match(
  css,
  /\.home-merchandising-canvas__scene\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*100%/,
  "Tall merchandising vector scene must scale with the entire canvas."
);

assert.match(
  css,
  /@media \(max-width: 700px\)[\s\S]*?\.home-merchandising-canvas__waves--top[\s\S]*?opacity:\s*0\.68[\s\S]*?\.home-merchandising-canvas__waves--bottom[\s\S]*?opacity:\s*0\.72/,
  "Tall merchandising atmosphere must reduce intensity on small screens."
);

assert.ok(
  !css.includes(".home-merchandising-canvas::before") &&
    !css.includes(".home-merchandising-canvas::after"),
  "Merchandising canvas must not depend on pseudo-element ribbons."
);
const merchandisingCanvasRule = css.split(".home-merchandising-canvas {")[1]?.split("}")[0] ?? "";
assert.ok(merchandisingCanvasRule, "Merchandising canvas requires its approved base style.");
assert.ok(
  !merchandisingCanvasRule.includes("repeating-linear-gradient") &&
    !merchandisingCanvasRule.includes("background-image: url("),
  "Merchandising canvas must not depend on repeating patterns or raster backgrounds."
);

assert.doesNotMatch(
  css,
  /\.home-next-step::before\s*\{/,
  "Next-step CTA must not create a photographic background layer."
);

assert.doesNotMatch(
  css,
  /\.home-next-step::after\s*\{/,
  "Next-step CTA must not create a dark image overlay."
);

assert.match(
  home,
  /function HomeNextStep\([\s\S]*?Shop your way[\s\S]*?Pay when it&apos;s delivered\.[\s\S]*?Cash on Delivery[\s\S]*?Start shopping[\s\S]*?See our story/,
  "Closing CTA must use the approved Cash on Delivery hierarchy."
);

assert.doesNotMatch(
  home,
  /className="home-next-step__story"/,
  "Closing CTA must not restore the removed Discover Ysabelle story strip."
);

assert.doesNotMatch(
  home,
  /Start shopping\s*<ArrowRight/,
  "Primary shop CTA must not render the old arrow icon."
);

assert.match(
  home,
  /className="customer-button home-next-step__shop-button"[\s\S]*?>\s*Start shopping\s*<\/CustomerLink>/,
  "Primary shop CTA must use the dedicated shine-animation button class."
);

assert.doesNotMatch(
  home,
  /Simple store pickup|Cash on pickup|Pay When You Collect It/,
  "Closing CTA must not restore pickup-only messaging."
);

assert.match(
  home,
  /function HomeNextStepVisual\(\)[\s\S]*?viewBox="0 0 720 520"[\s\S]*?nextStepBasket[\s\S]*?home-next-step__cart/,
  "Closing CTA must render the scalable shopping-cart visual rather than a raster background."
);

assert.match(
  css,
  /\.home-next-step__main\s*\{[\s\S]*?grid-template-columns:[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
  "Closing CTA must remain a full-width section composition without a floating card shell."
);

assert.match(
  css,
  /\.home-next-step\s*\{[\s\S]*?url\("\/media\/home-delivery-closing-background\.svg"\) center \/ cover no-repeat/,
  "Closing CTA must use the approved balanced blue-violet background artwork."
);

assert.match(
  css,
  /\.home-next-step__visual\s*\{[\s\S]*?position:\s*relative;[\s\S]*?min-height:\s*25rem/,
  "Delivery illustration must keep a stable responsive visual stage."
);
assert.match(
  css,
  /\.home-next-step__visual-svg\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*visible/,
  "Delivery illustration must remain scalable vector artwork."
);

assert.doesNotMatch(
  css,
  /\.home-next-step__story(?:\s|\{|:)/,
  "Removed story strip styles must not remain in the premium home stylesheet."
);

assert.match(
  css,
  /\.home-next-step__shop-button::after[\s\S]*?rgb\(255 255 255 \/ 62%\)[\s\S]*?transform:\s*translateX\(-260%\) skewX\(-18deg\)/,
  "Primary shop CTA must render a restrained shine layer."
);

assert.match(
  css,
  /@keyframes home-next-step-button-shine[\s\S]*?translateX\(650%\) skewX\(-18deg\)[\s\S]*?@media \(prefers-reduced-motion: no-preference\)[\s\S]*?home-next-step__shop-button::after[\s\S]*?animation:\s*home-next-step-button-shine 4\.8s ease-in-out infinite/,
  "Primary shop CTA shine must animate only when motion is allowed."
);

assert.match(home, /<div className="home-merchandising-stage">/);
assert.match(
  home,
  /<div className="home-merchandising-stage">[\s\S]*?<div className="home-merchandising-canvas">[\s\S]*?<MerchandisingArea[\s\S]*?<section className="customer-section home-essentials">[\s\S]*?<\/div>[\s\S]*?<HomeNextStep/,
  "Trending, Best Sellers, and Everyday Essentials must share one canvas while the next-step CTA stays outside it."
);


/* Shop catalog and the homepage merchandising shelves share the SAME dark galaxy. */
const storefrontTheme = readFileSync(resolve(process.cwd(), "src/styles/theme-storefront.css"), "utf8");
const shopCatalogBackdrop = readFileSync(resolve(process.cwd(), "src/components/customer/ShopCatalogBackdrop.tsx"), "utf8");
const galaxyArtwork = readFileSync(resolve(process.cwd(), "src/components/customer/StorefrontGalaxyArtwork.tsx"), "utf8");

assert.match(
  storefrontTheme,
  /:root\.dark \.customer-app \.home-merchandising-canvas\s*\{[^}]*background:\s*var\(--storefront-galaxy-background\)/,
  "Approved Trending through Essentials background must remain the source of truth."
);
assert.match(
  storefrontTheme,
  /:root\.dark \.customer-app \.customer-shop-page \.customer-shop-catalog-backdrop\s*\{[\s\S]*?var\(--storefront-galaxy-background\)/,
  "Shop catalog should use the approved single shared galaxy palette."
);
assert.match(
  shopCatalogBackdrop,
  /<StorefrontGalaxyArtwork className="customer-shop-catalog-backdrop__cosmos" \/>/,
  "Shop catalog should reuse the original SVG constellation rather than a raster imitation."
);
assert.match(galaxyArtwork, /preserveAspectRatio="xMidYMid meet"/, "SVG must not stretch to the catalog's variable height.");
assert.match(
  storefrontTheme,
  /\.customer-shop-catalog-backdrop__cosmos\s*\{[^}]*display:\s*none/,
  "Artwork must stay hidden in light mode."
);
assert.match(
  storefrontTheme,
  /\.customer-shop-page \.customer-shop-catalog-backdrop\s*\{[\s\S]*?#101827 100%/,
  "Last Shop backdrop pixel must match the existing footer transition surface."
);


/* Account Orders/Favorites/Profile/Security share the one approved galaxy. */
const accountPageSource = readFileSync(resolve(process.cwd(), "src/pages/customer/CustomerAccountPage.tsx"), "utf8");

assert.match(
  accountPageSource,
  /<StorefrontGalaxyArtwork className="customer-account-page-v2__cosmos" \/>/,
  "Account must reuse the same SVG constellation component as Shop and Home."
);
assert.match(
  storefrontTheme,
  /:root\.dark \.customer-app \.customer-account-page-v2\.ys-glass-flow-background\s*\{[\s\S]*?var\(--storefront-galaxy-background\) !important/,
  "Account dark-mode background must reuse the approved shared palette over legacy material image."
);
assert.match(
  storefrontTheme,
  /\.customer-account-page-v2\.ys-glass-flow-background\s*\{[\s\S]*?background-repeat:\s*no-repeat !important/,
  "Account page must never vertically repeat the galaxy texture."
);
assert.match(
  storefrontTheme,
  /\.customer-account-page-v2\.ys-glass-flow-background\s*\{[\s\S]*?#101827 100%/,
  "Account background must fade into the unchanged footer surface."
);
assert.match(
  storefrontTheme,
  /\.customer-account-page-v2__cosmos\s*\{[^}]*display:\s*none/,
  "Account constellation must not appear in light mode."
);
assert.match(
  storefrontTheme,
  /\.customer-account-page-v2 > \.customer-account-layout-v2\s*\{[^}]*z-index:\s*1/,
  "Account content must remain in front of decorative SVG."
);
assert.doesNotMatch(
  storefrontTheme,
  /\.customer-account-page-v2__cosmos\s*\{[^}]*background-size:\s*100% 100%/,
  "Do not stretch artwork to fill long account pages."
);

/* Sign In reuses exactly the approved Account/Shop galaxy, not a stretched
   auth silk image. This remains conditional on login: register/recovery intact. */
const customerAuthFrameSource = readFileSync(resolve(process.cwd(), "src/components/customer/CustomerAuthFrame.tsx"), "utf8");
const storefrontContrast = readFileSync(resolve(process.cwd(), "src/styles/theme-storefront-contrast.css"), "utf8");
assert.match(
  customerAuthFrameSource,
  /mode === "login" \? \([\s\S]*?<StorefrontGalaxyArtwork className="customer-auth-page--login__cosmos" \/>/,
  "Only Sign In should render the shared constellation inside the auth frame."
);
assert.match(
  storefrontContrast,
  /:root\.dark \.customer-app \.customer-auth-page--login\.ys-glass-flow-background\s*\{[\s\S]*?var\(--storefront-galaxy-background\) !important/,
  "Sign In must use the shared midnight galaxy rather than the old auth silk texture."
);
assert.match(
  storefrontContrast,
  /\.customer-auth-page--login\.ys-glass-flow-background\s*\{[\s\S]*?background-repeat:\s*no-repeat !important/,
  "Sign In should never vertically repeat or stretch a bitmap texture."
);
assert.match(
  storefrontContrast,
  /\.customer-auth-page--login\.ys-glass-flow-background\s*\{[\s\S]*?#101827 100%/,
  "Sign In must fade into the existing footer background."
);
assert.match(
  storefrontContrast,
  /\.customer-auth-page--login__cosmos\s*\{[^}]*display:\s*none/,
  "The Sign In galaxy must be hidden in light mode."
);
assert.match(
  storefrontContrast,
  /\.customer-auth-page--login > \.customer-auth-stage\s*\{[^}]*z-index:\s*1/,
  "The sign-in card must remain above decorative artwork."
);
assert.match(
  storefrontContrast,
  /\.customer-auth-page--login::before,[\s\S]*?\.customer-auth-page--login::after\s*\{[^}]*content:\s*none/,
  "Old animated login backdrop glows must be removed instead of overlaying the galaxy."
);

/* A dark-mode login entered from Account must not inherit the previous page
   scroll offset or show the pre-galaxy faceted card overlay. */
const loginPageSource = readFileSync(resolve(process.cwd(), "src/pages/customer/CustomerLoginPage.tsx"), "utf8");
assert.match(
  loginPageSource,
  /useEffect\(\(\) => \{\s*globalThis\.scrollTo\?\.\(\{ top: 0, left: 0, behavior: "auto" \}\);\s*\}, \[\]\)/,
  "Sign In must start at the top instead of opening with its card under the sticky header."
);
assert.match(
  storefrontContrast,
  /:root\.dark \.customer-app \.customer-auth-page--login\s+\.customer-auth-stage__panel\.ys-material-surface::before\s*\{[^}]*content:\s*none/,
  "The login card should not display the legacy material facet texture over the galaxy."
);
assert.match(
  storefrontContrast,
  /:root\.dark \.customer-app \.customer-auth-page--login\s+\.customer-auth-stage::before\s*\{[^}]*animation:\s*none/,
  "Only the login stage should stop its obsolete orbital glow animation."
);

/* Login-only orbital balance must never modify the shared artwork. */
assert.match(
  customerAuthFrameSource,
  /className="customer-auth-page--login__balanced-orbits"[\s\S]*?preserveAspectRatio="xMidYMid slice"/,
  "Sign In orbital accents should use their own proportional SVG, not a stretched image."
);
assert.match(
  customerAuthFrameSource,
  /<circle cx="1560" cy="155" r="365"/,
  "Primary Sign In orbit should be anchored on the right edge."
);
assert.match(
  customerAuthFrameSource,
  /<circle cx="76" cy="1065" r="322"/,
  "Counterbalancing Sign In orbit should remain faint on the lower left."
);
assert.match(
  storefrontContrast,
  /\.customer-auth-page--login__cosmos g\[fill="none"\]:not\(\[stroke\]\)\s*\{[^}]*opacity:\s*0\.28/,
  "The inherited left orbital rings should be toned down in Sign In only."
);
assert.match(
  storefrontContrast,
  /\.customer-app \.customer-auth-page--login__balanced-orbits\s*\{[^}]*display:\s*none/,
  "The added orbit design must remain hidden in light mode."
);
assert.match(
  storefrontContrast,
  /:root\.dark \.customer-app \.customer-auth-page--login__balanced-orbits\s*\{[^}]*pointer-events:\s*none/,
  "Decorative orbits should never block login buttons or text fields."
);

console.log("Storefront Shop/Catalog background contract passed.");
