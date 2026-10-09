import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const customerAuthService = await import("../frontend/src/services/customerAuthService.ts");
  const routes = await import("../frontend/src/utils/customerRoutes.ts");

  assert.equal(
    typeof customerAuthService.requestCustomerPasswordRecovery,
    "function",
    "Expected requestCustomerPasswordRecovery service function."
  );
  assert.equal(
    typeof customerAuthService.verifyCustomerPasswordRecoveryCode,
    "function",
    "Expected verifyCustomerPasswordRecoveryCode service function."
  );
  assert.equal(
    typeof customerAuthService.resetCustomerPassword,
    "function",
    "Expected resetCustomerPassword service function."
  );
  assert.equal(routes.getCustomerAuthPageKind("/account-recovery"), "recovery");
  assert.equal(routes.resolveCustomerAuthRedirect("/account-recovery", "authenticated"), null);
  assert.equal(routes.resolveCustomerAuthRedirect("/account-recovery", "unauthenticated"), null);

  const loginSource = await readFile("frontend/src/pages/customer/CustomerLoginPage.tsx", "utf8");
  const appSource = await readFile("frontend/src/app/CustomerApp.tsx", "utf8");
  const recoverySource = await readFile(
    "frontend/src/pages/customer/CustomerAccountRecoveryPage.tsx",
    "utf8"
  );
  const recoveryCss = await readFile("frontend/src/styles/customer-auth-recovery.css", "utf8");

  assert.match(loginSource, /Forgot password\?/);
  assert.match(loginSource, /\/account-recovery/);
  assert.match(appSource, /CustomerAccountRecoveryPage/);
  assert.match(appSource, /pathname === "\/account-recovery"/);
  assert.match(recoverySource, /Enter verification code/);
  assert.match(recoverySource, /Set a new password/);
  assert.match(recoverySource, /Password reset complete/);
  assert.match(recoverySource, /confirmPassword/);
  /* Email is the only account identifier accepted by the public recovery UI.
     Keep the established backend JSON key for request/verify compatibility. */
  assert.ok(
    recoverySource.includes("const RECOVERY_EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;"),
    "Account recovery must use a valid email-only format check."
  );
  assert.match(
    recoverySource,
    /const normalizedEmail = identifier\.trim\(\)\.toLowerCase\(\)/,
    "Recovery must trim and normalize email before sending a code."
  );
  assert.match(recoverySource, /setError\("Enter your email address\."\)/);
  assert.match(recoverySource, /setError\("Enter a valid email address\."\)/);
  assert.match(
    recoverySource,
    /Enter the email address associated with your customer account\./,
    "Identify description should only ask for the registered email."
  );
  assert.match(
    recoverySource,
    /<span>Email address<\/span>\s*<input[\s\S]*?autoComplete="section-customer email"[\s\S]*?inputMode="email"[\s\S]*?placeholder="name@example\.com"[\s\S]*?required\s+type="email"/,
    "Identify should have email label, keyboard, autofill, placeholder and semantic input type."
  );
  assert.doesNotMatch(
    recoverySource,
    /Enter the username, email, or mobile number|Username, email or mobile number|Username, email, or 09XXXXXXXXX/,
    "Recovery UI must not suggest username or mobile input."
  );
  assert.match(recoverySource, /sendRecoveryCode\(normalizedEmail\)/);
  assert.match(
    recoverySource,
    /verifyCustomerPasswordRecoveryCode\(\{\s*identifier,\s*verificationCode\s*\}\)/,
    "Verify stage must retain the established recovery service contract."
  );

  assert.match(recoverySource, /role="alert"/);
  assert.match(recoverySource, /role="status"/);
  assert.match(recoveryCss, /linear-gradient/);
  assert.match(recoveryCss, /@media/);
  const authFrameSource = await readFile(
    "frontend/src/components/customer/CustomerAuthFrame.tsx",
    "utf8"
  );
  const storefrontContrast = await readFile(
    "frontend/src/styles/theme-storefront-contrast.css",
    "utf8"
  );
  const sharedGalaxyArtwork = await readFile(
    "frontend/src/components/customer/StorefrontGalaxyArtwork.tsx",
    "utf8"
  );
  assert.match(
    authFrameSource,
    /mode === "recovery" \? \([\s\S]*?aria-hidden="true" className="customer-auth-page--recovery__artwork"[\s\S]*?<StorefrontGalaxyArtwork className="customer-auth-page--recovery__cosmos" \/>/,
    "All Identify, Verify, Secure and complete steps must share one recovery backdrop."
  );
  assert.match(
    storefrontContrast,
    /:root\.dark \.customer-app \.customer-auth-page--recovery\.ys-glass-flow-background\s*\{[^}]*background-image:[\s\S]*?var\(--storefront-galaxy-background\) !important;/,
    "Dark Recovery must use the approved storefront galaxy palette, overriding the pastel wallpaper."
  );
  assert.match(
    storefrontContrast,
    /\.customer-auth-page--recovery\.ys-glass-flow-background\s*\{[^}]*#101827 100%/,
    "Recovery's last pixel must blend into the shared footer."
  );
  assert.match(
    storefrontContrast,
    /\.customer-auth-page--recovery\.ys-glass-flow-background\s*\{[^}]*background-repeat:\s*no-repeat !important;/,
    "Recovery background must never tile or stretch a bitmap texture."
  );
  assert.match(
    storefrontContrast,
    /\.customer-app \.customer-auth-page--recovery__artwork\s*\{[^}]*display:\s*none;/,
    "Galaxy artwork must remain hidden in recovery light mode."
  );
  assert.match(
    storefrontContrast,
    /:root\.dark \.customer-app \.customer-auth-page--recovery::before,[\s\S]*?\.customer-auth-page--recovery::after\s*\{[^}]*content:\s*none;/,
    "Remove the old animated recovery blobs instead of overlaying the new galaxy."
  );
  assert.match(
    storefrontContrast,
    /\.customer-auth-page--recovery > \.customer-auth-stage\s*\{[^}]*z-index:\s*1;/,
    "Recovery forms must stay above the decorative SVG."
  );
  assert.match(
    sharedGalaxyArtwork,
    /preserveAspectRatio="xMidYMid meet"/,
    "Shared constellation must stay proportional at every recovery stage height."
  );


  /* Verify cooldown remains readable despite disabled state, and the
     post-reset Secure confirmation uses light text on a dark surface. */
  assert.match(
    storefrontContrast,
    /\.customer-auth-page--recovery \.customer-recovery-resend > span\s*\{[^}]*color:\s*#d4deec;/,
    "Recovery resend prompt must be legible against the dark verification panel."
  );
  assert.match(
    storefrontContrast,
    /\.customer-auth-page--recovery \.customer-recovery-resend \.customer-recovery-secondary\s*\{[^}]*color:\s*#e7dfff;/,
    "Enabled recovery resend button must override the generic dark-on-dark auth text."
  );
  assert.match(
    storefrontContrast,
    /\.customer-recovery-resend \.customer-recovery-secondary:disabled\s*\{[^}]*color:\s*#b8c6dc;[^}]*opacity:\s*1;/,
    "Resend cooldown must remain visibly disabled, without dimming its text to illegibility."
  );
  assert.match(
    storefrontContrast,
    /\.customer-auth-page--recovery \.customer-recovery-status--success\s*\{[^}]*background:\s*linear-gradient\(135deg, #293a56 0%, #24334b 100%\)/,
    "Secure completion must use a dark panel instead of a pale contrasting rectangle."
  );
  assert.match(
    storefrontContrast,
    /\.customer-recovery-status--success > div > strong\s*\{[^}]*color:\s*#f2f5ff;/,
    "Recovery success title must be readable in dark mode."
  );
  assert.match(
    storefrontContrast,
    /\.customer-recovery-status--success > div > span\s*\{[^}]*color:\s*#cbd8ec;/,
    "Recovery success details must be readable in dark mode."
  );
  assert.match(recoverySource, /disabled=\{submitting \|\| resendCooldown > 0\}/);
  assert.match(recoverySource, /resendCooldown > 0 \? `Resend code in \$\{resendCooldown\}s` : "Resend code"/);
  assert.match(recoverySource, /customer-recovery-status--success" role="status"/);

  assert.match(
    recoveryCss,
    /\.customer-auth-page--recovery\s+\.customer-auth-stage\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    "Recovery must override the inherited desktop two-column auth grid with a single fluid column."
  );
  assert.match(
    recoveryCss,
    /\.customer-auth-page--recovery\s+\.customer-auth-stage\s*\{[^}]*width:\s*min\(100%,\s*44rem\)/s,
    "Recovery desktop stage should retain the premium 44rem maximum width."
  );

  const requests: Array<{ init: RequestInit; url: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof URL ? input.toString() : String(input);
    requests.push({ init: init ?? {}, url });
    return new Response(JSON.stringify({ success: true, message: "Request successful." }), {
      headers: { "content-type": "application/json" },
      status: 200
    });
  };

  try {
    await customerAuthService.requestCustomerPasswordRecovery("maria@example.com");
    const requestCall = requests.at(-1);
    assert.ok(requestCall);
    assert.equal(new URL(requestCall.url).pathname, "/api/customer-auth/recovery/request");
    assert.equal(requestCall.init.method, "POST");
    assert.equal(requestCall.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(requestCall.init.body)), {
      identifier: "maria@example.com"
    });

    await customerAuthService.verifyCustomerPasswordRecoveryCode({
      identifier: "maria@example.com",
      verificationCode: "123456"
    });
    const verifyCall = requests.at(-1);
    assert.ok(verifyCall);
    assert.equal(new URL(verifyCall.url).pathname, "/api/customer-auth/recovery/verify");
    assert.equal(verifyCall.init.method, "POST");
    assert.equal(verifyCall.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(verifyCall.init.body)), {
      identifier: "maria@example.com",
      verificationCode: "123456"
    });

    await customerAuthService.resetCustomerPassword({
      newPassword: "CustomerPass456!"
    });
    const resetCall = requests.at(-1);
    assert.ok(resetCall);
    assert.equal(new URL(resetCall.url).pathname, "/api/customer-auth/recovery/reset");
    assert.equal(resetCall.init.method, "POST");
    assert.equal(resetCall.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(resetCall.init.body)), {
      newPassword: "CustomerPass456!"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("Customer account recovery frontend contract passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
