import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

const app = read("frontend/src/app/CustomerApp.tsx");
const footer = read("frontend/src/components/customer/CustomerFooter.tsx");
const terms = read("frontend/src/pages/customer/TermsOfServicePage.tsx");
const termsCss = read("frontend/src/styles/customer-terms.css");
const privacyCss = read("frontend/src/styles/customer-privacy.css");
const mobileCss = read("frontend/src/styles/customer-adaptive-mobile.css");

test("public terms route is available without customer authentication", () => {
  assert.match(app, /pathname === "\/terms"/);
  assert.match(app, /TermsOfServicePage navigate=\{navigate\}/);
  assert.match(footer, /href="\/terms"/);
  assert.match(app, /import "@\/styles\/customer-terms.css"/);
  assert.match(
    read("frontend/src/components/customer/PrivacyNotice.tsx"),
    /pathname !== "\/terms"/
  );
});

test("terms reuse Privacy Policy layout, legal reading surfaces, and dark tokens", () => {
  assert.match(terms, /customer-privacy-page customer-terms-page/);
  assert.match(terms, /CategoryRetailBackdrop/);
  assert.match(terms, /StorefrontGalaxyArtwork/);
  assert.match(terms, /customer-privacy-document/);
  assert.match(terms, /customer-privacy-hero__summary/);
  assert.match(privacyCss, /--privacy-paper/);
  assert.match(privacyCss, /\[data-theme="dark"\]/);
  assert.match(terms, /Philippine law/);
  assert.match(terms, /consumer rights/);
  assert.match(terms, /Contact Customer Support/);
});

test("terms provide accessible compact TOC and flexible phone typography", () => {
  assert.match(terms, /aria-controls="customer-terms-toc-links"/);
  assert.match(terms, /aria-expanded=\{tocOpen\}/);
  assert.match(terms, /data-mobile-open=\{tocOpen\}/);
  assert.match(terms, /setTocOpen\(false\)/);
  assert.match(termsCss, /@media \(max-width: 520px\)/);
  assert.match(termsCss, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(termsCss, /overflow-wrap: break-word/);
});

test("phone merchandising labels cannot be hidden by the decorative handoff or reveal", () => {
  assert.match(mobileCss, /home-category-merch-handoff\s*\{\s*display: none;/);
  assert.match(mobileCss, /home-merchandising--trending/);
  assert.match(mobileCss, /home-section-heading__eyebrow\s*\{[^}]*padding-block: 0\.12rem;/);
  assert.match(mobileCss, /home-section-heading__title\s*\{[^}]*line-height: 1\.18;/);
  assert.match(
    mobileCss,
    /@media \(max-width: 700px\) and \(prefers-reduced-motion: no-preference\)/
  );
});
