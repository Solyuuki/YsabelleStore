import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("retail login uses a full-width single-column phone layout, not the desktop grid", () => {
  const page = read("frontend/src/pages/WelcomePage.tsx");
  const css = read("frontend/src/styles/welcome-appearance.css");
  const global = read("frontend/src/styles/global.css");
  const mobile = css.split("/* Sprint 12: retail staff login becomes phone-first.")[1];
  assert.ok(mobile, "Missing phone login composition");
  assert.match(
    global,
    /\.welcome-content\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(clamp\(25rem, 30vw, 35rem\), 0\.78fr\);/
  );
  assert.match(mobile, /@media \(max-width: 700px\)/);
  assert.match(
    mobile,
    /\.ys-retail-welcome \.welcome-content\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/
  );
  assert.match(
    mobile,
    /\.ys-retail-welcome \.ys-retail-login-card\s*\{[^}]*width: 100%;[^}]*max-width: 100%;[^}]*min-width: 0;/
  );
  assert.match(
    mobile,
    /\.ys-retail-welcome \.ys-retail-welcome__hero\s*\{[^}]*max-width: 100%;[^}]*min-width: 0;/
  );
  assert.match(mobile, /\.ys-retail-welcome\s*\{[^}]*overflow-x: clip;[^}]*overflow-y: visible;/);
  assert.match(mobile, /\.ys-retail-welcome \.welcome-shell\s*\{[^}]*min-height: 100svh;/);
  assert.match(mobile, /@media \(max-width: 359px\)/);
  assert.doesNotMatch(mobile, /@media \(max-width: 768px\)/);
  assert.match(page, /className="ys-retail-welcome__hero auth-hero-enter/);
});

test("mobile intro is concise and card controls remain accessible and touch-friendly", () => {
  const page = read("frontend/src/pages/WelcomePage.tsx");
  const css = read("frontend/src/styles/welcome-appearance.css");
  const mobile = css.split("/* Sprint 12: retail staff login becomes phone-first.")[1];
  assert.match(
    page,
    /className="ys-retail-welcome__mobile-intro">Retail workspace · Owner &amp; Staff/
  );
  assert.match(page, /className="ys-retail-welcome__description/);
  assert.match(
    mobile,
    /\.ys-retail-welcome \.ys-retail-welcome__description\s*\{\s*display: none;/
  );
  assert.match(
    mobile,
    /\.ys-retail-welcome \.ys-retail-welcome__mobile-intro\s*\{\s*display: block;/
  );
  assert.match(
    mobile,
    /\.ys-retail-welcome \.ys-retail-login-card input:not\(\[type="checkbox"\]\)\s*\{[^}]*min-height: 44px;/
  );
  assert.match(
    mobile,
    /\.ys-retail-welcome \.ys-retail-login-card form > button,[\s\S]*?min-height: 44px;/
  );
  assert.match(
    mobile,
    /\.ys-retail-welcome \.ys-retail-known-account button\s*\{[^}]*min-height: 44px;/
  );
  assert.match(
    mobile,
    /\.ys-retail-welcome \.ys-retail-theme-control__label\s*\{\s*display: none;/
  );
  assert.match(
    mobile,
    /\.ys-retail-welcome \.ys-retail-welcome__title\s*\{[^}]*white-space: nowrap;/
  );
  assert.match(page, /aria-label="Dark mode for login and retail workspace"/);
  assert.match(page, /aria-label=\{showPassword \? "Hide password" : "Show password"\}/);
  assert.match(page, /onSubmit=\{handleSubmit\}/);
  assert.match(page, /onLogin\(nextEmail, password\)/);
  assert.match(page, /onContinueWithTrustedDevice\(account\)/);
  assert.match(page, /onRemoveRememberedAccount\(account\.id\)/);
});

test("retail theme preference and desktop welcome composition stay intact", () => {
  const page = read("frontend/src/pages/WelcomePage.tsx");
  const css = read("frontend/src/styles/welcome-appearance.css");
  assert.match(page, /checked=\{retailTheme === "dark"\}/);
  assert.match(page, /setRetailTheme\(event\.target\.checked \? "dark" : "light"\)/);
  assert.match(
    css,
    /:root\.dark\[data-appearance-scope="retail"\] \.ys-retail-welcome\.ys-glass-flow-background/
  );
  assert.match(css, /background-size: auto !important;/);
  assert.match(css, /background-repeat: no-repeat !important;/);
  assert.match(css, /:root\.dark \.ys-retail-welcome \.ys-retail-login-card/);
  assert.match(css, /:root\.dark \.ys-retail-welcome \.ys-retail-welcome__mobile-intro/);
  assert.match(page, /className="ys-retail-login-card auth-card-enter welcome-card/);
  assert.match(page, /className="ys-retail-welcome-footer auth-footer-enter welcome-footer/);
});
