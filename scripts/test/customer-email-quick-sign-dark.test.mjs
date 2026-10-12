import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(text, surface) {
  const a = luminance(text);
  const b = luminance(surface);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("Email Quick Sign dark styles are scoped to its login flow, leaving light mode untouched", () => {
  const css = read("frontend/src/styles/theme-storefront-contrast.css");
  const start = css.indexOf("/* Sprint 11 — Email Quick Sign");
  const end = css.indexOf("/* Checkout dark canvas:", start);
  assert.ok(start >= 0 && end > start, "Missing Quick Sign stylesheet boundaries");
  const section = css.slice(start, end);
  assert.ok(section.length > 500, "Missing Quick Sign dark-mode styles");

  const selectors = section.match(/:root\.dark/g) ?? [];
  assert.ok(selectors.length >= 17, "Insufficient dark-mode coverage");
  assert.ok(!section.includes(":root.light"));
  assert.ok(!section.includes("!important"));
  assert.ok(section.includes(".customer-auth-page--login"));
  assert.ok(section.includes(".customer-email-quick-sign.customer-mobile-auth"));
  assert.ok(section.includes("background: linear-gradient(155deg, #1b2a43"));
});

test("both email and 6-digit verification stages retain legible colors, focus, icons, and notices", () => {
  const css = read("frontend/src/styles/theme-storefront-contrast.css");
  const page = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");
  const otp = read("frontend/src/components/customer/CustomerVerificationCode.tsx");

  for (const selector of [
    ".customer-email-quick-sign__intro h2",
    ".customer-email-quick-sign__eyebrow",
    ".customer-email-quick-sign__intro > p:last-child",
    '.customer-auth-field input[type="email"]',
    '.customer-auth-field input[type="email"]::placeholder',
    ".customer-verification-code__label",
    ".customer-verification-code__slot",
    '.customer-verification-code__slot[data-active="true"]',
    ".customer-email-quick-sign__remember",
    ".customer-email-quick-sign__remember small",
    ".customer-email-quick-sign__status",
    ".customer-email-quick-sign__status-icon",
    ".customer-email-quick-sign__status strong",
    ".customer-email-quick-sign__form > .customer-auth-submit",
    ".customer-mobile-auth__secondary",
    ".customer-email-quick-sign__back",
    ".customer-auth-alert"
  ]) {
    assert.ok(
      css.replace(/\s+/g, " ").includes(selector),
      "Missing Quick Sign dark state: " + selector
    );
  }
  assert.ok(page.includes('stage === "email"'));
  assert.ok(page.includes('stage !== "code"'));
  assert.ok(page.includes("customer-email-quick-sign__form--verify"));
  assert.ok(page.includes("CustomerVerificationCode"));
  assert.ok(otp.includes("customer-verification-code__slot"));
});

test("key dark-mode text/surface combinations meet WCAG AA normal-text contrast", () => {
  const css = read("frontend/src/styles/theme-storefront-contrast.css");
  const cases = [
    ["heading", "#f3f6ff", "#1b2a43"],
    ["eyebrow", "#c2b7ff", "#1b2a43"],
    ["description", "#c8d6ec", "#1b2a43"],
    ["field", "#f0f5ff", "#15233b"],
    ["placeholder", "#b9c9e1", "#15233b"],
    ["OTP slot", "#f5f7ff", "#273953"],
    ["remember checkbox copy", "#edf3ff", "#253651"],
    ["remember helper", "#c2d0e6", "#253651"],
    ["sent-code notice", "#c6d4ea", "#293956"],
    ["button blue", "#ffffff", "#245fd1"],
    ["button violet", "#ffffff", "#5540bd"],
    ["button pink", "#ffffff", "#932876"],
    ["back action", "#c4d2e9", "#202e48"]
  ];

  for (const [description, foreground, background] of cases) {
    assert.ok(css.includes(foreground), description + " foreground token missing");
    assert.ok(css.includes(background), description + " surface token missing");
    assert.ok(contrast(foreground, background) >= 4.5, description + " contrast below AA");
  }
});
