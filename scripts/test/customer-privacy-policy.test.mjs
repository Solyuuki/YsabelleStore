import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const app = read("frontend/src/app/CustomerApp.tsx");
const layout = read("frontend/src/layouts/CustomerLayout.tsx");
const footer = read("frontend/src/components/customer/CustomerFooter.tsx");
const notice = read("frontend/src/components/customer/PrivacyNotice.tsx");
const policy = read("frontend/src/pages/customer/PrivacyPolicyPage.tsx");
const privacyContent = read("frontend/src/content/privacy.ts");
const privacyCss = read("frontend/src/styles/customer-privacy.css");

test("storefront exposes a dedicated privacy route and persistent footer access", () => {
  assert.match(app, /pathname === "\/privacy"/);
  assert.match(app, /PrivacyPolicyPage/);
  assert.match(layout, /<PrivacyNotice navigate=\{navigate\} pathname=\{pathname\}/);
  assert.match(footer, /href="\/privacy"/);
  assert.match(footer, /Privacy &amp; cookies/);
});

test("privacy notice is informational and does not manufacture a general agreement", () => {
  assert.match(notice, /Service and security storage keeps requested store features working/);
  assert.match(notice, /Storage details/);
  assert.match(notice, /Dismiss privacy notice/);
  assert.doesNotMatch(notice, /I agree|Accept all|Accept cookies|Agree and continue/i);
  assert.match(notice, /PRIVACY_NOTICE_VERSION/);
});

test("privacy content reflects current security and device-storage implementation", () => {
  assert.match(privacyContent, /ysabelle_customer_session/);
  assert.match(privacyContent, /Up to 7 days/);
  assert.match(privacyContent, /ysabelle_customer_remembered_browser/);
  assert.match(privacyContent, /up to 365 days/i);
  assert.match(privacyContent, /trust.*30 days/i);
  assert.match(privacyContent, /ysabelle:guest-cart:v1/);
  assert.match(privacyContent, /ysabelle:storefront:recent-searches/);
  assert.match(privacyContent, /ysabelle:pending-favorite/);
  assert.match(privacyContent, /ysabelle-store-entrance-entered/);
  assert.match(privacyContent, /ysabelle:privacy-notice-version/);
});

test("privacy policy documents Philippine law, processors, rights, and no current ad tracker", () => {
  assert.match(policy, /Data Privacy Act of 2012/);
  assert.match(policy, /Republic Act No\. 10173/);
  assert.match(policy, /National Privacy Commission/);
  assert.match(policy, /PayMongo/);
  assert.match(policy, /Google/);
  assert.match(policy, /Facebook/);
  assert.match(policy, /Resend/);
  assert.match(policy, /No advertising tracker configured/);
  assert.match(policy, /Inventory forecasting is not customer profiling/);
  assert.match(policy, /Contact Customer Support/);
  assert.match(privacyContent, /Right|rights/i);
});

test("privacy UI is responsive, material-aware, and reduced-motion safe", () => {
  assert.match(privacyCss, /backdrop-filter:\s*blur/);
  assert.match(privacyCss, /customer-privacy-hero/);
  assert.match(privacyCss, /customer-privacy-layout/);
  assert.match(privacyCss, /@media \(max-width: 720px\)/);
  assert.match(privacyCss, /@media \(max-width: 520px\)/);
  assert.match(privacyCss, /@media \(prefers-reduced-motion: reduce\)/);
});
