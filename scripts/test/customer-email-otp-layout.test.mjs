import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("OTP verification label is centered above the digit slots", () => {
  const css = read("frontend/src/styles/customer-auth-quick-sign.css");

  assert.match(
    css,
    /\.customer-email-otp legend\s*\{[\s\S]*?justify-self:\s*center;[\s\S]*?text-align:\s*center;[\s\S]*?\}/
  );
});

test("remember-account choice is compact and centered", () => {
  const css = read("frontend/src/styles/customer-known-accounts.css");

  assert.match(
    css,
    /\.customer-remember-choice\s*\{[\s\S]*?width:\s*min\(100%, 25rem\);[\s\S]*?justify-self:\s*center;[\s\S]*?\}/
  );
});

test("OTP verify button is compact and centered", () => {
  const css = read("frontend/src/styles/customer-auth-quick-sign.css");

  assert.match(
    css,
    /\.customer-mobile-auth \.customer-auth-submit\s*\{[\s\S]*?width:\s*min\(100%, 25rem\);[\s\S]*?justify-self:\s*center;[\s\S]*?\}/
  );
});
