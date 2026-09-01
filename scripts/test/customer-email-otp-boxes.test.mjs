import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("email OTP uses the shared shadcn input-otp verification component", () => {
  const emailPanel = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");
  const shared = read("frontend/src/components/customer/CustomerVerificationCode.tsx");
  const primitive = read("frontend/src/components/ui/input-otp.tsx");
  const packageJson = read("frontend/package.json");

  assert.match(packageJson, /"input-otp": "\^1\.5\.0"/);
  assert.match(primitive, /import \{ OTPInput, OTPInputContext \} from "input-otp"/);
  assert.match(shared, /InputOTP, InputOTPGroup, InputOTPSlot/);
  assert.match(shared, /REGEXP_ONLY_DIGITS/);
  assert.match(shared, /maxLength=\{6\}/);
  assert.match(shared, /pattern=\{REGEXP_ONLY_DIGITS\}/);
  assert.match(shared, /Array\.from\(\{ length: 6 \}/);
  assert.match(emailPanel, /CustomerVerificationCode/);
  assert.match(emailPanel, /value=\{verificationCode\}/);
  assert.match(emailPanel, /onChange=\{setVerificationCode\}/);
});

test("shared email OTP delegates paste and keyboard behavior to input-otp", () => {
  const emailPanel = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");
  const shared = read("frontend/src/components/customer/CustomerVerificationCode.tsx");

  assert.doesNotMatch(emailPanel, /useRef/);
  assert.doesNotMatch(emailPanel, /handleOtpPaste/);
  assert.doesNotMatch(emailPanel, /handleOtpKeyDown/);
  assert.match(shared, /autoComplete="one-time-code"/);
  assert.match(shared, /inputMode="numeric"/);
});

test("shared OTP slots use recovery-style premium proportions", () => {
  const css = read("frontend/src/styles/customer-verification-code.css");

  assert.match(css, /width:\s*min\(100%, 31rem\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /gap:\s*0\.72rem/);
  assert.match(css, /min-height:\s*72px/);
  assert.match(css, /font-size:\s*clamp\(1\.7rem, 4vw, 2\.05rem\)/);
  assert.match(css, /\.customer-verification-code__slot\[data-active="true"\]/);
});

test("OTP verification still submits only through the Verify button", () => {
  const component = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");

  assert.match(component, /const \[verificationCode, setVerificationCode\] = useState\(""\)/);
  assert.match(component, /if \(!\/\^\\d\{6\}\$\/\.test\(verificationCode\)\)/);
  assert.match(component, /verifyCustomerEmailAuth\(\{ email, verificationCode, rememberFor30Days \}\)/);
  assert.match(component, /submitting \? "Verifying\.\.\." : "Verify"/);
  assert.doesNotMatch(component, /onComplete=/);
});
