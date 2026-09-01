import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("shared OTP label is centered above recovery-style slots", () => {
  const css = read("frontend/src/styles/customer-verification-code.css");

  assert.match(
    css,
    /\.customer-verification-code__label\s*\{[\s\S]*?text-align:\s*center;[\s\S]*?\}/
  );
});

test("email verification remember choice follows the Quick Sign balanced form width", () => {
  const css = read("frontend/src/styles/customer-email-quick-sign-reference.css");

  assert.match(
    css,
    /\.customer-email-quick-sign__form\s*\{[\s\S]*?width:\s*min\(100%, 31rem\);[\s\S]*?justify-self:\s*center;[\s\S]*?\}/
  );
  assert.match(
    css,
    /\.customer-email-quick-sign__form\s*>\s*:is\([\s\S]*?\.customer-email-quick-sign__remember[\s\S]*?\)\s*\{[\s\S]*?width:\s*100%;[\s\S]*?justify-self:\s*stretch;[\s\S]*?\}/
  );
});

test("email verification Verify code button follows the Quick Sign balanced form width", () => {
  const css = read("frontend/src/styles/customer-email-quick-sign-reference.css");

  assert.match(
    css,
    /\.customer-email-quick-sign__form\s*\{[\s\S]*?width:\s*min\(100%, 31rem\);[\s\S]*?justify-self:\s*center;[\s\S]*?\}/
  );
  assert.match(
    css,
    /\.customer-email-quick-sign__form\s*>\s*:is\([\s\S]*?\.customer-auth-submit[\s\S]*?\)\s*\{[\s\S]*?width:\s*100%;[\s\S]*?justify-self:\s*stretch;[\s\S]*?\}/
  );
});
