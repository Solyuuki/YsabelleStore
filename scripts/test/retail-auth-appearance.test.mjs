import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Known Accounts uses an accessible native switch backed by the retail appearance provider", () => {
  const page = read("frontend/src/pages/WelcomePage.tsx");
  const context = read("frontend/src/context/AppearanceContext.tsx");
  const index = read("frontend/index.html");

  assert.match(page, /const \{ retailTheme, setRetailTheme \} = useAppearance\(\)/);
  assert.match(page, /role="switch"/);
  assert.match(page, /type="checkbox"/);
  assert.match(page, /aria-label="Dark mode for login and retail workspace"/);
  assert.match(page, /checked=\{retailTheme === "dark"\}/);
  assert.match(page, /setRetailTheme\(event\.target\.checked \? "dark" : "light"\)/);
  assert.match(context, /RETAIL_THEME_KEY = "ysabellestore\.appearance\.retail\.v1"/);
  assert.match(context, /saveTheme\(RETAIL_THEME_KEY, value\)/);
  assert.match(index, /"\/staff-login"/);
  assert.match(index, /const scope = retailPaths\.has\(path\) \? "retail" : "storefront"/);
});

test("login, dashboard and Settings share one persisted retail preference", () => {
  const context = read("frontend/src/context/AppearanceContext.tsx");
  const appShell = read("frontend/src/app/AppShell.tsx");
  const settings = read("frontend/src/pages/SettingsPage.tsx");

  assert.match(appShell, /syncForPath\(path\)/);
  assert.match(appShell, /navigate\("\/dashboard"\)/);
  assert.match(context, /root\.classList\.toggle\("dark", dark\)/);
  assert.match(settings, /const \{ retailTheme, setRetailTheme \} = useAppearance\(\)/);
  assert.match(settings, /setRetailTheme\("dark"\)/);
});

test("dark sign-in reuses Trending through Essentials galaxy without tiling or changing storefront", () => {
  const page = read("frontend/src/pages/WelcomePage.tsx");
  const css = read("frontend/src/styles/welcome-appearance.css");
  const retail = read("frontend/src/styles/theme-retail.css");
  const storefront = read("frontend/src/styles/theme-storefront.css");
  const artwork = read("frontend/src/components/customer/StorefrontGalaxyArtwork.tsx");

  assert.match(page, /ys-retail-welcome ys-material-canvas/);
  assert.match(page, /@\/styles\/welcome-appearance\.css/);
  assert.match(page, /ys-retail-known-account/);
  assert.match(page, /import \{ StorefrontGalaxyArtwork \} from/);
  assert.match(page, /<StorefrontGalaxyArtwork\s+className="ys-retail-welcome__cosmos"/);
  assert.match(page, /aria-hidden="true" className="ys-retail-welcome__galaxy"/);
  assert.match(artwork, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(retail, /--storefront-galaxy-background:/);
  assert.match(storefront, /background: var\(--storefront-galaxy-background\)/);
  assert.match(css, /:root\.dark\[data-appearance-scope="retail"\] \.ys-retail-welcome/);
  assert.match(css, /background-image: var\(--storefront-galaxy-background\) !important;/);
  assert.match(css, /background-size: auto !important;/);
  assert.match(css, /background-repeat: no-repeat !important;/);
  assert.match(css, /\.ys-retail-welcome__galaxy \{/);
  assert.match(css, /\.ys-retail-welcome__cosmos \{/);
  assert.match(css, /mask-image: linear-gradient\(to bottom/);
  assert.doesNotMatch(css, /ys-dark-midnight-velvet\.svg/);
  assert.doesNotMatch(css, /background-repeat:\s*repeat-y/);
  assert.doesNotMatch(css, /background-size:\s*cover/i);
  assert.match(css, /\.ys-retail-theme-switch input:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
