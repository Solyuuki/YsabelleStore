import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("support concern dropdown uses one chevron with an edge-safe gutter in both modes", () => {
  const css = read("frontend/src/styles/customer-support-mobile.css");
  const page = read("frontend/src/pages/customer/CustomerSupportPage.tsx");
  const contrast = read("frontend/src/styles/theme-storefront-contrast.css");
  const theme = read("frontend/src/styles/theme-storefront.css");

  assert.match(page, /import "@\/styles\/customer-support-mobile\.css"/);
  assert.match(page, /className="customer-support-select-wrap"/);
  assert.match(page, /<select\s+onChange=/);
  assert.match(
    page,
    /<ChevronDown[\s\S]*?className="customer-support-select-chevron"[\s\S]*?size=\{18\}/
  );
  assert.equal(
    (page.match(/className="customer-support-select-chevron"/g) ?? []).length,
    1,
    "Exactly one real SVG arrow must be mounted"
  );
  assert.match(
    css,
    /\.customer-support-select-wrap select\s*\{[^}]*appearance: none;[^}]*padding-right: 3rem;[^}]*background-image: none !important;/
  );
  assert.match(
    css,
    /\.customer-support-select-chevron\s*\{[^}]*position: absolute;[^}]*right: 1rem;[^}]*pointer-events: none;/
  );
  assert.match(
    css,
    /:root\.dark \.customer-app \.customer-support-select-wrap \.customer-support-select-chevron\s*\{[^}]*color: #d8e5fb;/
  );
  assert.doesNotMatch(css, /background-image: url\(/);
  assert.match(
    contrast,
    /customer-support-form :is\(input, select, textarea\)\s*\{[^}]*background: #17243a;/
  );
  assert.match(theme, /\.customer-support-form select,[\s\S]*?background: #152139;/);
});

test("mobile contact support stays form-first with optional verified-contact summary", () => {
  const page = read("frontend/src/pages/customer/CustomerSupportPage.tsx");
  const css = read("frontend/src/styles/customer-support-mobile.css");
  assert.match(page, /className="customer-support-account-note__mobile"/);
  assert.match(page, /\{customerName\}/);
  assert.match(page, /\{customerEmail\}/);
  assert.match(page, /customer-support-form__verified-fields/);
  assert.match(page, /customer-support-form__verified-phone/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(
    css,
    /\.customer-app \.customer-support-form__verified-fields,[\s\S]*?\.customer-app \.customer-support-form__verified-phone,[\s\S]*?\{\s*display: none;/
  );
  assert.match(
    css,
    /\.customer-app \.customer-support-account-note__mobile\s*\{[^}]*display: grid;/
  );
  assert.match(
    css,
    /\.customer-app \.customer-support-form :is\(input, select\)\s*\{[^}]*min-height: 46px;/
  );
  assert.match(css, /\.customer-app \.customer-support-form textarea\s*\{[^}]*min-height: 136px;/);
  assert.match(
    css,
    /\.customer-app \.customer-support-submit\s*\{[^}]*width: 100%;[^}]*min-height: 46px;/
  );
  assert.match(css, /\.customer-app \.customer-support-hero__card\s*\{\s*display: none;/);
});

test("supplemental help remains accessible, while the mobile FAQ and tips start compact", () => {
  const page = read("frontend/src/pages/customer/CustomerSupportPage.tsx");
  const css = read("frontend/src/styles/customer-support-mobile.css");

  assert.match(
    page,
    /const\s*\[showSupportTips,\s*\s*setShowSupportTips\]\s*=\s*useState\(false\)/
  );
  assert.match(page, /const\s*\[showSupportFaq,\s*\s*setShowSupportFaq\]\s*=\s*useState\(false\)/);
  assert.match(page, /aria-controls="customer-support-tips-panel"/);
  assert.match(page, /aria-expanded=\{showSupportTips\}/);
  assert.match(page, /aria-controls="customer-support-faq-list"/);
  assert.match(page, /aria-expanded=\{showSupportFaq\}/);
  assert.match(page, /setShowSupportTips\(\(open\)\s*=>\s*!open\)/);
  assert.match(page, /setShowSupportFaq\(\(open\)\s*=>\s*!open\)/);
  assert.match(page, /FAQS\.map\(\(faq\)\s*=>/);
  assert.match(css, /\.customer-app\s*\.customer-support-faq__list\s*\{\s*display:\s*none;/);
  assert.match(
    css,
    /\.customer-app\s*\.customer-support-faq\[data-mobile-open="true"\]\s*\.customer-support-faq__list\s*\{\s*display:\s*grid;/
  );
  assert.match(
    css,
    /\.customer-app\s*\.customer-support-sidebar\[data-mobile-open="true"\]\s*\.customer-support-sidebar__content\s*\{\s*display:\s*grid;/
  );
  assert.match(
    css,
    /\.customer-app\s*\.customer-support-mobile-disclosure:focus-visible\s*\{[^}]*outline:\s*3px/
  );
  assert.match(
    css,
    /:root\.dark\s*\.customer-app\s*\.customer-support-mobile-disclosure\s*\{[^}]*color:\s*#eef3ff;/
  );
});

test("support request validation, guest contact fields and reference remain operational", () => {
  const page = read("frontend/src/pages/customer/CustomerSupportPage.tsx");
  for (const item of [
    "customerName: customerName.trim()",
    "customerEmail: customerEmail.trim()",
    "customerPhone: customerPhone.trim() || undefined",
    "category,",
    "orderNumber: orderNumber.trim() || undefined",
    "subject: subject.trim()",
    "message: message.trim()",
    "createdTicket.ticketNumber",
    "Never send your password, OTP",
    "submitCustomerSupportTicket"
  ]) {
    assert.ok(page.includes(item), "Missing support workflow: " + item);
  }
  assert.match(page, /const ORDER_RELATED_CATEGORIES = new Set<CustomerSupportCategory>/);
  assert.match(page, /ORDER_RELATED_CATEGORIES\.has\(category\)/);
  assert.match(page, /!ORDER_RELATED_CATEGORIES\.has\(nextCategory\)/);
  assert.match(page, /customer-support-form__order-reference--nonpurchase/);
  assert.match(page, /disabled=\{signedIn\}/);
  assert.match(page, /createdTicket\.ticketNumber/);
});
