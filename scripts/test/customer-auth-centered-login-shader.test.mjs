import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("customer login and register use centered premium shader cards", () => {
  const shaderPath = "frontend/src/styles/customer-auth-login-premium.css";
  assert.equal(existsSync(fileUrl(shaderPath)), true, "premium auth shader stylesheet must exist");

  const frame = read("frontend/src/components/customer/CustomerAuthFrame.tsx");
  const css = read(shaderPath);

  assert.match(frame, /import "@\/styles\/customer-auth-login-premium\.css";/);
  assert.doesNotMatch(frame, /customer-auth-stage__brand/);
  assert.doesNotMatch(frame, /YsabelleBrandMark/);
  assert.doesNotMatch(frame, /Continue to shop/);

  assert.match(
    css,
    /\.customer-auth-page--login,\s*\.customer-auth-page--register\s*\{[\s\S]*?display:\s*grid;[\s\S]*?place-items:\s*center;/
  );
  assert.match(
    css,
    /\.customer-auth-page--login \.customer-auth-stage\s*\{[\s\S]*?width:\s*min\(100%,\s*42rem\);[\s\S]*?display:\s*block;/
  );
  assert.match(
    css,
    /\.customer-auth-page--register \.customer-auth-stage\s*\{[\s\S]*?width:\s*min\(100%,\s*58rem\);[\s\S]*?display:\s*block;/
  );
  assert.match(
    css,
    /\.customer-auth-page--login \.customer-auth-stage__panel,\s*\.customer-auth-page--register \.customer-auth-stage__panel\s*\{[\s\S]*?backdrop-filter:\s*blur\(24px\) saturate\(140%\);/
  );
  assert.match(css, /rgb\(0 140 255/);
  assert.match(css, /rgb\(98 91 255/);
  assert.match(css, /rgb\(168 60 240/);
  assert.match(css, /rgb\(244 63 140/);
  assert.match(css, /@keyframes\s+ysabelle-login-aurora/);
  assert.match(css, /@keyframes\s+ysabelle-login-orbit/);
  assert.match(css, /animation:\s*ysabelle-login-aurora/);
  assert.match(css, /animation:\s*ysabelle-login-orbit/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none;/);
});
