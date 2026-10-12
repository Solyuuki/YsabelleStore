import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("support category select uses a padded chevron in light and dark modes", () => {
  const css = read("frontend/src/styles/customer-support-mobile.css");
  const page = read("frontend/src/pages/customer/CustomerSupportPage.tsx");

  assert.match(page, /import "@\/styles\/customer-support-mobile\.css"/);
  assert.match(page, /<select\s+onChange=/);
  assert.match(css, /\.customer-app \.customer-support-page \.customer-support-form select\s*\{[^}]*appearance: none;[^}]*padding-right: 3rem;/);
  assert.match(css, /background-position: right 1rem center;/);
  assert.match(css, /background-size: 1rem 1rem;/);
  assert.match(css, /:root\.dark \.customer-app \.customer-support-page \.customer-support-form select\s*\{[^}]*color: #edf2ff;[^}]*background-color: #17243a;[^}]*background-image:/);
  assert.doesNotMatch(css, /right (?:0(?:px|rem)?|0\.25rem) center/);
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
  assert.match(css, /\.customer-app \.customer-support-form__verified-fields,[\s\S]*?\.customer-app \.customer-support-form__verified-phone,[\s\S]*?\{\s*display: none;/);
  assert.match(css, /\.customer-app \.customer-support-account-note__mobile\s*\{[^}]*display: grid;/);
  assert.match(css, /\.customer-app \.customer-support-form :is\(input, select\)\s*\{[^}]*min-height: 46px;/);
  assert.match(css, /\.customer-app \.customer-support-form textarea\s*\{[^}]*min-height: 136px;/);
  assert.match(css, /\.customer-app \.customer-support-submit\s*\{[^}]*width: 100%;[^}]*min-height: 46px;/);
  assert.match(css, /\.customer-app \.customer-support-hero__card\s*\{\s*display: none;/);
});

test("supplemental help remains accessible, while the mobile FAQ and tips start compact", () => {
  const page = read("frontend/src/pages/customer/CustomerSupportPage.tsx");
  const css = read("frontend/src/styles/customer-support-mobile.css");

  assert.match(page, /const \[showSupportTips, setShowSupportTips\] = useState\(false\)/);
  assert.match(page, /const \[showSupportFaq, setShowSupportFaq\] = useState\(false\)/);
  assert.match(page, /aria-controls="customer-support-tips-panel"/);
  assert.match(page, /aria-expanded=\{showSupportTips\}/);
  assert.match(page, /aria-controls="customer-support-faq-list"/);
  assert.match(page, /aria-expanded=\{showSupportFaq\}/);
  assert.match(page, /setShowSupportTips\(\(open\) => !open\)/);
  assert.match(page, /setShowSupportFaq\(\(open\) => !open\)/);
  assert.match(page, /FAQS\.map\(\(faq\) =>/);
  assert.match(css, /\.customer-app \.customer-support-faq__list\s*\{\s*display: none;/);
  assert.match(css, /\.customer-app \.customer-support-faq\[data-mobile-open="true"\] \.customer-support-faq__list\s*\{\s*display: grid;/);
  assert.match(css, /\.customer-app \.customer-support-sidebar\[data-mobile-open="true"\] \.customer-support-sidebar__content\s*\{\s*display: grid;/);
  assert.match(css, /\.customer-app \.customer-support-mobile-disclosure:focus-visible\s*\{[^}]*outline: 3px/);
  assert.match(css, /:root\.dark \.customer-app \.customer-support-mobile-disclosure\s*\{[^}]*color: #eef3ff;/);
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
