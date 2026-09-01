import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("register Email Quick Sign is email-only and authenticates or creates independently", () => {
  const register = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");

  assert.match(register, /CustomerEmailAuthPanel/);
  assert.match(register, /CustomerEmailRegistrationPanel/);
  assert.match(register, /"registration-email"\s*\|\s*"quick-email"\s*\|\s*null/);
  assert.match(register, /const \{[^}]*refreshSession[^}]*register[^}]*\} = useCustomerAuth\(\)/s);
  assert.match(
    register,
    /async function handleQuickSignVerified\(\)[\s\S]*?await refreshSession\(\);[\s\S]*?navigate\("\/"\);/
  );
  assert.match(
    register,
    /emailLabel="Continue with Email OTP"[\s\S]*?onEmailStart=\{\(\) => \{[\s\S]*?setVerificationPanel\("quick-email"\);[\s\S]*?\}\}/
  );
  assert.match(
    register,
    /verificationPanel === "quick-email"[\s\S]*?<CustomerEmailAuthPanel[\s\S]*?onVerified=\{handleQuickSignVerified\}/
  );
  assert.match(
    register,
    /verifiedEmail !== email\.trim\(\)[\s\S]*?setVerificationPanel\("registration-email"\);[\s\S]*?return;/
  );
  assert.doesNotMatch(register, /This verified email can be used for Email Quick Sign\./);
});
