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

test("email verification remember choice uses the shared balanced width", () => {
  const css = read("frontend/src/styles/customer-verification-code.css");

  assert.match(
    css,
    /\.customer-mobile-auth__form:has\(\.customer-verification-code\) \.customer-remember-choice\s*\{[\s\S]*?width:\s*min\(100%, 31rem\);[\s\S]*?justify-self:\s*center;[\s\S]*?\}/
  );
});

test("email verification Verify button uses the shared balanced width", () => {
  const css = read("frontend/src/styles/customer-verification-code.css");

  assert.match(
    css,
    /\.customer-mobile-auth__form:has\(\.customer-verification-code\) > \.customer-auth-submit\s*\{[\s\S]*?width:\s*min\(100%, 31rem\);[\s\S]*?justify-self:\s*center;[\s\S]*?\}/
  );
});
