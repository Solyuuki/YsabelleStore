import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("email OTP uses the official shadcn input-otp primitive", () => {
  const component = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");
  const primitive = read("frontend/src/components/ui/input-otp.tsx");
  const packageJson = read("frontend/package.json");

  assert.match(packageJson, /"input-otp": "\^1\.5\.0"/);
  assert.match(primitive, /import \{ OTPInput, OTPInputContext \} from "input-otp"/);
  assert.match(primitive, /function InputOTP\(/);
  assert.match(primitive, /function InputOTPGroup\(/);
  assert.match(primitive, /function InputOTPSlot\(/);
  assert.match(primitive, /data-slot="input-otp-slot"/);
  assert.match(component, /InputOTP, InputOTPGroup, InputOTPSlot/);
  assert.match(component, /REGEXP_ONLY_DIGITS/);
  assert.match(component, /maxLength=\{6\}/);
  assert.match(component, /pattern=\{REGEXP_ONLY_DIGITS\}/);
  assert.match(component, /value=\{verificationCode\}/);
  assert.match(component, /onChange=\{setVerificationCode\}/);
  assert.match(component, /Array\.from\(\{ length: 6 \}/);
});

test("email OTP delegates paste and keyboard behavior to input-otp", () => {
  const component = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");

  assert.doesNotMatch(component, /useRef/);
  assert.doesNotMatch(component, /handleOtpPaste/);
  assert.doesNotMatch(component, /handleOtpKeyDown/);
  assert.doesNotMatch(component, /applyOtpDigits/);
  assert.doesNotMatch(component, /otpInputRefs/);
  assert.match(component, /autoComplete="one-time-code"/);
  assert.match(component, /inputMode="numeric"/);
});

test("premium OTP slots stay compact and readable", () => {
  const css = read("frontend/src/styles/customer-auth-quick-sign.css");

  assert.match(css, /\.customer-email-otp__control\s*\{/);
  assert.match(css, /\.customer-email-otp__group\s*\{/);
  assert.match(css, /\.customer-email-otp__slot\s*\{/);
  assert.match(css, /width:\s*3rem;/);
  assert.match(css, /height:\s*3\.25rem;/);
  assert.match(css, /font-size:\s*1\.3rem;/);
  assert.match(css, /\.customer-email-otp__slot\[data-active="true"\]/);
  assert.doesNotMatch(css, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
});

test("OTP verification still submits only through the Verify button", () => {
  const component = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");

  assert.match(component, /const \[verificationCode, setVerificationCode\] = useState\(""\)/);
  assert.match(component, /if \(!\/\^\\d\{6\}\$\/\.test\(verificationCode\)\)/);
  assert.match(component, /verifyCustomerEmailAuth\(\{ email, verificationCode, rememberFor30Days \}\)/);
  assert.match(
    component,
    /<button className="customer-auth-submit" disabled=\{submitting\} type="submit">\s*\{submitting \? "Verifying\.\.\." : "Verify"\}\s*<\/button>/s
  );
  assert.doesNotMatch(component, /onComplete=/);
});
