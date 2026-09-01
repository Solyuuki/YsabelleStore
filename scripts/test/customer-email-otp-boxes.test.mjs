import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("email OTP renders six premium digit boxes instead of one code field", () => {
  const component = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");
  const css = read("frontend/src/styles/customer-auth-quick-sign.css");

  assert.match(component, /useRef/);
  assert.match(component, /customer-email-otp__group/);
  assert.match(component, /customer-email-otp__digit/);
  assert.match(component, /Array\.from\(\{ length: 6 \}/);
  assert.match(component, /aria-label=\{`Digit \$\{index \+ 1\} of 6`\}/);
  assert.match(component, /inputMode="numeric"/);
  assert.match(component, /autoComplete=\{index === 0 \? "one-time-code" : "off"\}/);
  assert.doesNotMatch(component, /id="customer-email-auth-code"/);

  assert.match(css, /\.customer-email-otp__group\s*\{/);
  assert.match(css, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.customer-email-otp__digit\s*\{/);
  assert.match(css, /\.customer-email-otp__digit\.is-filled/);
  assert.match(css, /\.customer-email-otp__digit:focus/);
});

test("email OTP supports keyboard navigation and multi-digit paste", () => {
  const component = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");

  assert.match(component, /function applyOtpDigits/);
  assert.match(component, /function handleOtpPaste/);
  assert.match(component, /clipboardData\.getData\("text"\)/);
  assert.match(component, /replace\(\/\\D\/g, ""\)/);
  assert.match(component, /function handleOtpKeyDown/);
  assert.match(component, /event\.key === "Backspace"/);
  assert.match(component, /event\.key === "ArrowLeft"/);
  assert.match(component, /event\.key === "ArrowRight"/);
  assert.match(component, /otpInputRefs\.current\[.*?\]\?\.focus\(\)/s);
});

test("OTP verification still submits a six-digit code without auto-submitting", () => {
  const component = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");

  assert.match(component, /const verificationCode = otpDigits\.join\(""\)/);
  assert.match(component, /verifyCustomerEmailAuth\(\{ email, verificationCode, rememberFor30Days \}\)/);
  assert.match(component, />\{submitting \? "Verifying\.\.\." : "Verify"\}<\/button>/s);
  assert.doesNotMatch(component, /otpDigits\.every\([\s\S]*?handleCodeSubmit/);
});
