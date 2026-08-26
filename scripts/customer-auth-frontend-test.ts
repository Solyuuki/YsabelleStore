import assert from "node:assert/strict";

async function main() {
  let importFailure: unknown = null;
  const customerAuthModule = await import("../frontend/src/services/customerAuthService.ts").catch(
    (error: unknown) => {
      importFailure = error;
      return null;
    }
  );

  if (!customerAuthModule) {
    console.error("customerAuthService import failed:", importFailure);
  }
  assert.ok(customerAuthModule, "Expected frontend customerAuthService to exist.");

  const requests: Array<{ init: RequestInit; url: string }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = input instanceof URL ? input.toString() : String(input);
    requests.push({ init: init ?? {}, url });

    const responseBody = url.endsWith("/api/customer-auth/logout")
      ? { success: true, message: "Customer logout successful." }
      : url.endsWith("/api/customer-auth/registration-intent")
        ? {
            success: true,
            message: "Customer registration intent prepared.",
            data: { ready: true }
          }
        : {
            success: true,
            message: "Customer authentication successful.",
            data: {
              customer: {
                id: "customer-1",
                name: "Maria Customer",
                username: "maria.customer",
                email: "maria@example.com",
                phone: "09171234567",
                status: "ACTIVE"
              }
            }
          };

    return new Response(JSON.stringify(responseBody), {
      headers: { "content-type": "application/json" },
      status: 200
    });
  };

  try {
    const currentCustomer = await customerAuthModule.getCurrentCustomer();
    assert.equal(currentCustomer?.email, "maria@example.com");
    assert.equal(currentCustomer?.username, "maria.customer");

    const meRequest = requests.at(-1);
    assert.ok(meRequest, "Expected current-customer request to be sent.");
    assert.equal(new URL(meRequest.url).pathname, "/api/customer-auth/me");
    assert.equal(meRequest.init.method ?? "GET", "GET");
    assert.equal(meRequest.init.credentials, "include");
    assert.equal(new Headers(meRequest.init.headers).has("Authorization"), false);

    const loggedIn = await customerAuthModule.loginCustomer({
      identifier: "maria@example.com",
      password: "CustomerPass123!"
    });
    assert.equal(loggedIn.email, "maria@example.com");

    const loginRequest = requests.at(-1);
    assert.ok(loginRequest, "Expected login request to be sent.");
    assert.equal(new URL(loginRequest.url).pathname, "/api/customer-auth/login");
    assert.equal(loginRequest.init.method, "POST");
    assert.equal(loginRequest.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(loginRequest.init.body)), {
      identifier: "maria@example.com",
      password: "CustomerPass123!"
    });

    const registered = await customerAuthModule.registerCustomer({
      email: "maria@example.com",
      name: "Maria Customer",
      password: "CustomerPass123!",
      phone: "09171234567",
      username: "maria.customer"
    });
    assert.equal(registered.id, "customer-1");

    const registerRequest = requests.at(-1);
    assert.ok(registerRequest, "Expected registration request to be sent.");
    assert.equal(new URL(registerRequest.url).pathname, "/api/customer-auth/register");
    assert.equal(registerRequest.init.method, "POST");
    assert.equal(registerRequest.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(registerRequest.init.body)), {
      email: "maria@example.com",
      name: "Maria Customer",
      password: "CustomerPass123!",
      phone: "09171234567",
      username: "maria.customer"
    });

    await customerAuthModule.logoutCustomer();
    const logoutRequest = requests.at(-1);
    assert.ok(logoutRequest, "Expected logout request to be sent.");
    assert.equal(new URL(logoutRequest.url).pathname, "/api/customer-auth/logout");
    assert.equal(logoutRequest.init.method, "POST");
    assert.equal(logoutRequest.init.credentials, "include");

    console.log("Frontend customer auth service contract passed.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
