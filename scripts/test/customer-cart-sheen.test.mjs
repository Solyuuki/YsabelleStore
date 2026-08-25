import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("header cart reuses the storefront CTA sheen without changing its compact layout", () => {
  const styles = read("frontend/src/styles/customer-header-actions.css");

  assert.match(
    styles,
    /\.customer-cart-link\s*\{[\s\S]*?min-height:\s*40px;[\s\S]*?padding-inline:\s*0\.72rem;[\s\S]*?position:\s*relative;[\s\S]*?isolation:\s*isolate;[\s\S]*?overflow:\s*hidden;/
  );
  assert.match(
    styles,
    /\.customer-cart-link > svg,[\s\S]*?\.customer-cart-link > span,[\s\S]*?\.customer-cart-link > strong\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*1;/
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion:\s*no-preference\)\s*\{[\s\S]*?\.customer-cart-link::after\s*\{[\s\S]*?pointer-events:\s*none;[\s\S]*?animation:\s*home-primary-cta-sheen 6800ms linear infinite;/
  );
  assert.doesNotMatch(styles, /\.customer-help-button::after|\.customer-account-link::after/);
});
