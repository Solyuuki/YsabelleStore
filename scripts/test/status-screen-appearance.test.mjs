import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL("../../" + path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

function luminance(hex) {
  const channels = hex.replace("#", "").match(/../g);
  assert.ok(channels && channels.length === 3, "Invalid color " + hex);
  const linear = channels.map((pair) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a, b) {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

test("all full-screen status variants share portal-aware appearance state", () => {
  const screen = read("frontend/src/components/shared/StatusScreen.tsx");
  const ctx = read("frontend/src/context/AppearanceContext.tsx");
  const routes = [
    "frontend/src/pages/NotFoundPage.tsx",
    "frontend/src/pages/customer/CustomerNotFoundPage.tsx",
    "frontend/src/pages/AccessDeniedPage.tsx",
    "frontend/src/components/shared/GlobalAuthenticationStatusScreen.tsx",
    "frontend/src/components/shared/GlobalReliabilityUI.tsx"
  ];
  const illustrations = read("frontend/src/components/shared/StatusIllustration.tsx");

  assert.match(screen, /createPortal\(screen, document\.body\)/);
  assert.match(screen, /getAppearanceScope\(window\.location\.pathname\)/);
  assert.match(screen, /appearanceScope === "retail" \? retailTheme : storefrontTheme/);
  assert.match(screen, /data-status-theme=\{statusTheme\}/);
  assert.match(ctx, /root\.classList\.toggle\("dark", dark\)/);

  for (const path of routes) {
    assert.match(read(path), /<StatusScreen\b/, "Not using shared screen: " + path);
  }
  for (const label of ["401", "403", "404", "503", "OFFLINE", "DATABASE", "SERVICE", "TIMEOUT"]) {
    assert.ok(illustrations.includes(label), "Missing illustration: " + label);
  }
  assert.match(screen, /className="status-screen__system-illustration"/);
  assert.match(screen, /<StatusIllustration statusLabel=\{statusLabel\} variant=\{variant\} \/>/);
  assert.doesNotMatch(screen, /BrandLogo|status-screen__brand-logo/);
  assert.doesNotMatch(screen, /<header\b/);
});

test("programmatic status portal focus has no viewport frame while actions retain focus", () => {
  const screen = read("frontend/src/components/shared/StatusScreen.tsx");
  const css = read("frontend/src/styles/global.css");

  assert.ok(screen.includes("containerRef.current?.focus({ preventScroll: true });"));
  assert.ok(screen.includes("tabIndex={-1}"));
  assert.ok(css.includes(".status-screen:focus {\n  outline: none;\n}"));
  assert.ok(
    css.includes("status-screen__secondary-action):focus-visible {\n  outline: 3px solid #c9c0ff;")
  );
});

test("dark status UI uses proportional galaxy artwork without changing light mode", () => {
  const screen = read("frontend/src/components/shared/StatusScreen.tsx");
  const css = read("frontend/src/styles/global.css");
  const retail = read("frontend/src/styles/theme-retail.css");
  const artwork = read("frontend/src/components/customer/StorefrontGalaxyArtwork.tsx");

  assert.match(screen, /bg-\[#F7F9FF\] text-\[#101426\]/);
  assert.match(screen, /<StorefrontGalaxyArtwork className="status-screen__cosmos-artwork" \/>/);
  assert.match(css, /\.status-screen-main\s*\{[^}]*padding-block: clamp\(2rem, 6vh, 4rem\);/);
  assert.doesNotMatch(css, /\.status-screen\[data-status-theme="dark"\] \.status-screen__brand-logo/);
  assert.match(css, /\.status-screen\[data-status-theme="dark"\] \{/);
  assert.match(css, /background-image: var\(--storefront-galaxy-background\);/);
  assert.match(css, /background-size: auto;/);
  assert.match(css, /background-repeat: no-repeat;/);
  assert.match(
    css,
    /\.status-screen\[data-status-theme="dark"\] \.status-screen__light-wash \{\s*display: none;/
  );
  assert.match(retail, /--storefront-galaxy-background:/);
  assert.match(artwork, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(artwork, /const centerQuiet =/);
  assert.doesNotMatch(css, /\.status-screen \{[^}]*background-color: #17243c/);
});

test("dark status text, badges, notes and interactive controls meet WCAG AA", () => {
  const css = read("frontend/src/styles/global.css");
  const samples = [
    ["heading", "#f0f4ff", "#17243c"],
    ["body", "#d2dff1", "#17243c"],
    ["eyebrow", "#c9c0ff", "#17243c"],
    ["footer", "#b8c9e4", "#17243c"],
    ["badge", "#e2ddff", "#2a2b56"],
    ["note title", "#f0f4ff", "#253650"],
    ["note body", "#d2dff1", "#253650"],
    ["primary button", "#ffffff", "#4f46e5"],
    ["primary hover", "#ffffff", "#4338ca"],
    ["secondary button", "#f0f4ff", "#253650"],
    ["secondary hover", "#f0f4ff", "#354c69"]
  ];

  for (const [name, ink, surface] of samples) {
    assert.ok(contrast(ink, surface) >= 4.5, name + " contrast below WCAG AA");
  }

  for (const className of [
    "status-screen__status-number",
    "status-screen__title",
    "status-screen__description",
    "status-screen__eyebrow",
    "status-screen__footer",
    "status-screen__code-badge",
    "status-screen__note",
    "status-screen__note-title",
    "status-screen__note-description",
    "status-screen__primary-action",
    "status-screen__secondary-action",
    "status-screen__system-illustration"
  ]) {
    assert.ok(
      css.includes('.status-screen[data-status-theme="dark"] .' + className),
      "Missing dark style for " + className
    );
  }
  assert.match(css, /:focus-visible \{\s*outline: 3px solid #c9c0ff;/);
});
