import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (name) => readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");

function luminance(hex) {
  const values = hex
    .replace("#", "")
    .match(/../g)
    .map((pair) => parseInt(pair, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

function contrastRatio(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("premium dark tokens meet WCAG AA on their intended solid surfaces", () => {
  const samples = [
    ["primary text / card", "#d4deec", "#1b2638", 4.5],
    ["body text / card", "#b8c6d8", "#1b2638", 4.5],
    ["helper text / card", "#9fafc6", "#1b2638", 4.5],
    ["strong card outline / card", "#687995", "#1b2638", 3],
    ["input text / input", "#d4deec", "#17243a", 4.5],
    ["primary action ink / brand fill", "#111827", "#8f82eb", 4.5]
  ];

  for (const [name, text, surface, threshold] of samples) {
    assert.ok(
      contrastRatio(text, surface) >= threshold,
      `${name} fails contrast: ${contrastRatio(text, surface).toFixed(2)}:1`
    );
  }
});

test("storefront and retail themes use new dark assets rather than light texture", () => {
  const store = read("frontend/src/styles/theme-storefront.css");
  const retail = read("frontend/src/styles/theme-retail.css");
  const component = read("frontend/src/styles/theme-storefront-contrast.css");
  const app = read("frontend/src/app/CustomerApp.tsx");

  assert.ok(store.includes("ys-dark-midnight-velvet.svg"));
  assert.ok(store.includes("ys-dark-indigo-silk.svg"));
  assert.ok(store.includes("ys-dark-graphite-glass.svg"));
  assert.ok(store.includes("ys-dark-delivery-closing.svg"));
  assert.ok(retail.includes("ys-dark-midnight-velvet.svg"));
  assert.ok(retail.includes("ys-dark-graphite-glass.svg"));
  assert.ok(app.includes("@/styles/theme-storefront-contrast.css"));
  for (const contents of [store, component, retail]) {
    assert.ok(
      !contents.includes("kpi-card-frosted-ribbon.webp"),
      "Old Light Mode texture referenced in Dark Mode theme"
    );
    assert.ok(
      !contents.includes(".about-experience"),
      "Protected About CSS selector present in a dark theme"
    );
  }
});

test("new image textures are separate from existing Light Mode assets", () => {
  for (const asset of [
    "frontend/public/textures/ys-dark-midnight-velvet.svg",
    "frontend/public/textures/ys-dark-graphite-glass.svg",
    "frontend/public/textures/ys-dark-indigo-silk.svg",
    "frontend/public/media/ys-dark-delivery-closing.svg"
  ]) {
    const contents = read(asset);
    assert.ok(contents.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(contents.includes('preserveAspectRatio="xMidYMid slice"'));
    assert.ok(contents.trimEnd().endsWith("</svg>"));
    assert.ok(!contents.includes("kpi-card-frosted-ribbon.webp"));
  }
});

test("About is excluded before theme is applied and original media stays in place", () => {
  const ctx = read("frontend/src/context/AppearanceContext.tsx");
  const entry = read("frontend/index.html");
  const about = read("frontend/src/pages/customer/AboutExperiencePage.tsx");

  assert.ok(ctx.includes('pathname === "/about"'));
  assert.ok(entry.includes('path === "/about"'));
  assert.ok(about.includes("storyTheme"));
});

test("dark storefront outlines and remaining light panels are explicitly addressed", () => {
  const contrast = read("frontend/src/styles/theme-storefront-contrast.css");
  const retail = read("frontend/src/styles/theme-retail.css");

  for (const selector of [
    ".customer-global-search__popup",
    ".customer-account-empty",
    ".customer-account-auth-methods > span",
    ".customer-account-password-change-current",
    ".customer-auth-page--recovery",
    ".home-next-step h2"
  ]) {
    assert.ok(contrast.includes(selector), `Dark styling missing: ${selector}`);
  }
  assert.match(contrast, /--store-outline-panel:\s*#64758f/);
  assert.match(contrast, /background-size:\s*min\(1600px, 100%\) auto/);
  assert.match(retail, /background-size:\s*min\(1600px, 100%\) auto !important/);
  assert.doesNotMatch(contrast, /\.about-experience|\.discover-story|\.story-welcome/);
});

test("staff Support conversation surfaces preserve dark-mode contrast", () => {
  const retail = read("frontend/src/styles/theme-retail.css");
  const inbox = read("frontend/src/pages/CustomerSupportInboxPage.tsx");

  for (const target of [
    "ys-support-inbox",
    "ys-support-ticket",
    "ys-support-thread",
    "ys-support-automated-email",
    "ys-support-customer-message",
    "ys-support-system-event",
    "ys-support-fact",
    "ys-support-reply-form",
    "ys-support-reply-trigger"
  ]) {
    assert.ok(inbox.includes(target), `Missing scoped Support component: ${target}`);
    assert.ok(retail.includes(`.${target}`), `Missing Support dark theme target: ${target}`);
  }
  assert.match(inbox, /data-active=\{active\}/);
  assert.match(retail, /:root\.dark \.app-shell-ambient \.ys-support-inbox/);
  assert.match(retail, /\.ys-support-ticket\[data-active="true"\]/);

  for (const [name, foreground, background] of [
    ["selected ticket", "#f3f6ff", "#354665"],
    ["automated email", "#eef3ff", "#293854"],
    ["email metadata", "#d2c6ff", "#293854"],
    ["customer message", "#ecf1ff", "#22334c"],
    ["system event", "#d7e2f5", "#2a3b56"]
  ]) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${name} text does not meet AA contrast`
    );
  }
});
