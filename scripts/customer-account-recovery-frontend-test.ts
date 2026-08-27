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
  assert.match(recoverySource, /Check your email/);
  assert.match(recoverySource, /Set a new password/);
  assert.match(recoverySource, /Password reset complete/);
  assert.match(recoverySource, /confirmPassword/);
  assert.match(recoverySource, /role="alert"/);
  assert.match(recoverySource, /role="status"/);
  assert.match(recoveryCss, /linear-gradient/);
  assert.match(recoveryCss, /@media/);

  const requests: Array<{ init: RequestInit; url: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof URL ? input.toString() : String(input);
    requests.push({ init: init ?? {}, url });
    return new Response(
      JSON.stringify({ success: true, message: "Request successful." }),
      { headers: { "content-type": "application/json" }, status: 200 }
    );
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

    await customerAuthService.resetCustomerPassword({
      token: "recovery-token-value-that-is-long-enough-123456",
      newPassword: "CustomerPass456!"
    });
    const resetCall = requests.at(-1);
    assert.ok(resetCall);
    assert.equal(new URL(resetCall.url).pathname, "/api/customer-auth/recovery/reset");
    assert.equal(resetCall.init.method, "POST");
    assert.equal(resetCall.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(resetCall.init.body)), {
      token: "recovery-token-value-that-is-long-enough-123456",
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
