import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("header cart sheen keeps visible brand contrast on the light cart surface", () => {
  const styles = read("frontend/src/styles/customer-header-actions.css");

  assert.match(
    styles,
    /\.customer-cart-link\s*\{[\s\S]*?min-height:\s*40px;[\s\S]*?padding-inline:\s*0\.72rem;[\s\S]*?background:\s*linear-gradient\(180deg, #fff, rgb\(98 91 255 \/ 7%\)\);/
  );
  assert.match(
    styles,
    /\.customer-cart-link > svg,[\s\S]*?\.customer-cart-link > span,[\s\S]*?\.customer-cart-link > strong\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*1;/
  );
  assert.match(
    styles,
    /\.customer-cart-link::after\s*\{[\s\S]*?rgb\(98 91 255 \/ 42%\)[\s\S]*?rgb\(255 255 255 \/ 86%\)[\s\S]*?rgb\(0 140 255 \/ 30%\)[\s\S]*?pointer-events:\s*none;[\s\S]*?animation:\s*home-primary-cta-sheen 6800ms linear infinite;/
  );
  assert.doesNotMatch(styles, /\.customer-help-button::after|\.customer-account-link::after/);
});
