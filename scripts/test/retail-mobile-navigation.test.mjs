import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("retail sidebar translates to a phone hamburger without altering tablet/desktop shell", () => {
  const layout = read("frontend/src/layouts/AppLayout.tsx");
  const sidebar = read("frontend/src/components/app/AppSidebar.tsx");
  const css = read("frontend/src/styles/retail-mobile-navigation.css");
  const nav = read("frontend/src/components/app/RetailMobileNavigation.tsx");

  assert.match(layout, /import \{ RetailMobileNavigation \} from "@\/components\/app\/RetailMobileNavigation";/);
  assert.match(layout, /import "@\/styles\/retail-mobile-navigation\.css";/);
  assert.match(layout, /<AppSidebar[\s\S]*?<RetailMobileNavigation[\s\S]*?activePath=\{activePath\}[\s\S]*?onLogout=\{onLogout\}[\s\S]*?onNavigate=\{onNavigate\}/);
  assert.match(layout, /<main[\s\S]*?data-layout="app"/);
  assert.match(sidebar, /retail-desktop-sidebar relative flex h-full/);

  // Phone portrait and common rotated-phone dimensions use the drawer.
  assert.match(css, /@media \(max-width: 767px\), \(max-height: 500px\) and \(orientation: landscape\) and \(max-width: 1024px\)/);
  assert.match(css, /\.app-shell-ambient > \.retail-desktop-sidebar\s*\{\s*display: none;/);
  assert.match(css, /\.app-shell-ambient \.retail-mobile-nav\s*\{[^}]*display: block;/);
  assert.match(css, /\.app-shell-ambient \.retail-workspace > main\[data-layout="app"\]/);
  assert.match(nav, /className="retail-mobile-nav__topbar"/);
  assert.match(nav, /<Sheet\s+open=\{drawerOpen\}/);
  assert.match(nav, /<SheetContent[\s\S]*?side="left"/);
  assert.match(nav, /aria-label="Open retail navigation"/);
  assert.match(nav, /aria-label="Close retail navigation"/);
  assert.match(nav, /mobileViewport\.addEventListener\("change", dismissIfDesktop\)/);
  assert.match(css, /\.retail-mobile-nav__drawer\[role="dialog"\]\s*\{[^}]*height: 100dvh;/);
});

test("phone links use the same role-authorized routes as the desktop app", () => {
  const nav = read("frontend/src/components/app/RetailMobileNavigation.tsx");
  const routes = read("frontend/src/app/routes.ts");
  const sidebar = read("frontend/src/components/app/AppSidebar.tsx");
  const shell = read("frontend/src/app/AppShell.tsx");

  for (const pathname of [
    "/dashboard", "/pos", "/inventory", "/deliveries", "/sales",
    "/customer-support", "/products", "/categories", "/receiving",
    "/forecast", "/historical-sales", "/reports", "/users", "/settings"
  ]) {
    assert.ok(nav.includes(`"${pathname}"`), `Missing mobile link: ${pathname}`);
    assert.ok(routes.includes(`path: "${pathname}"`), `Missing route registry entry: ${pathname}`);
  }
  assert.match(nav, /item !== undefined && item\.allowedRoles\.includes\(role\)/);
  assert.match(nav, /aria-current=\{activePath === path \? "page" : undefined\}/);
  assert.match(nav, /onClick=\{\(\) => navigateAndDismiss\(path\)\}/);
  assert.match(nav, /setDrawerOpen\(false\);[\s\S]*?onNavigate\(path\);/);
  assert.match(routes, /canRoleAccessRoute/);
  assert.match(shell, /if \(!canRoleAccessRoute\(route, user\?\.role\)\)/);
  assert.match(sidebar, /item\.allowedRoles\.includes\(user\?\.role \?\? "STAFF"\)/);
});

test("account actions remain accessible with confirmation and theme parity", () => {
  const nav = read("frontend/src/components/app/RetailMobileNavigation.tsx");
  const css = read("frontend/src/styles/retail-mobile-navigation.css");
  const shell = read("frontend/src/app/AppShell.tsx");

  assert.match(nav, /aria-label="Retail account options"/);
  assert.match(nav, /aria-expanded=\{accountOpen\}/);
  assert.match(nav, /aria-controls="retail-mobile-account-actions"/);
  assert.match(nav, /role === "OWNER" \? \(/);
  assert.match(nav, /navigateAndDismiss\("\/settings"\)/);
  assert.match(nav, /aria-label=\{\`Switch to \$\{retailTheme === "dark" \? "light" : "dark"\} mode\`\}/);
  assert.match(nav, /setRetailTheme\(retailTheme === "dark" \? "light" : "dark"\)/);
  assert.match(nav, /document\.addEventListener\("pointerdown", handleOutsideClick, true\)/);
  assert.match(nav, /document\.addEventListener\("keydown", handleEscape\)/);
  assert.match(nav, /document\.addEventListener\("focusin", handleFocusOutside\)/);
  assert.match(nav, /onLogout\(\);/);
  assert.match(shell, /<LogoutConfirmationModal/);
  assert.match(css, /:root\.dark \.app-shell-ambient \.retail-mobile-nav__topbar/);
  assert.match(css, /:root\.dark \.retail-mobile-nav__drawer\[role="dialog"\]/);
  assert.match(css, /:root\.dark \.app-shell-ambient \.retail-mobile-nav__account-popover/);
  assert.match(css, /min-width: 44px;/);
  assert.match(css, /env\(safe-area-inset-top, 0px\)/);
  assert.match(css, /:focus-visible/);
});
