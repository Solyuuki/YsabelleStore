import assert from "node:assert/strict";

async function main() {
  const storefrontService = await import("../frontend/src/services/storefrontService.ts");
  const customerAccountService = await import("../frontend/src/services/customerAccountService.ts");
  const accountStateModule = await import("../frontend/src/utils/customerAccountState.ts").catch(
    () => null
  );

  assert.equal(
    typeof storefrontService.fetchCustomerOrders,
    "function",
    "Expected fetchCustomerOrders to exist."
  );
  assert.equal(typeof customerAccountService.updateCustomerProfile, "function");
  assert.equal(typeof customerAccountService.claimCustomerUsername, "function");
  assert.equal(typeof customerAccountService.changeCustomerPassword, "function");
  assert.equal(typeof customerAccountService.fetchCustomerSessions, "function");
  assert.equal(typeof customerAccountService.revokeOtherCustomerSessions, "function");
  assert.ok(accountStateModule, "Expected customerAccountState helpers to exist.");
  assert.equal(
    typeof accountStateModule.getCustomerCheckoutDefaults,
    "function",
    "Expected getCustomerCheckoutDefaults to exist."
  );

  const requests: Array<{ init: RequestInit; url: string }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = input instanceof URL ? input.toString() : String(input);
    requests.push({ init: init ?? {}, url });
    const pathname = new URL(url).pathname;

    const customer = {
      id: "customer-1",
      name: "Maria Customer",
      username: "maria.customer",
      email: "maria@example.com",
      phone: "+639171234567",
      status: "ACTIVE"
    };
    const order = {
      id: "order-1",
      orderNumber: "YS-20260823-ABC123",
      status: "PENDING",
      fulfillmentMethod: "STORE_PICKUP",
      paymentMethod: "CASH_ON_PICKUP",
      totalAmount: "30",
      createdAt: "2026-08-23T00:00:00.000Z",
      itemCount: 2,
      items: [
        {
          productId: "product-1",
          productName: "Test Grocery",
          quantity: 2,
          unitPrice: "15",
          totalAmount: "30"
        }
      ]
    };

    let data: unknown = order;
    if (pathname === "/api/customer-account/orders") data = [order];
    else if (pathname === "/api/customer-account/sessions") {
      data = {
        sessions: [
          {
            id: "session-1",
            current: true,
            createdAt: "2026-08-26T00:00:00.000Z",
            lastUsedAt: "2026-08-26T01:00:00.000Z",
            expiresAt: "2026-09-02T00:00:00.000Z"
          }
        ]
      };
    } else if (pathname === "/api/customer-account/sessions/revoke-others") {
      data = { revokedCount: 1 };
    } else if (
      pathname === "/api/customer-account/profile" ||
      pathname === "/api/customer-account/username/claim" ||
      pathname === "/api/customer-account/password/change"
    ) {
      data = { customer };
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Request successful.",
        data
      }),
      { headers: { "content-type": "application/json" }, status: 200 }
    );
  };

  try {
    const orders = await storefrontService.fetchCustomerOrders();
    assert.equal(orders.length, 1);
    assert.equal(orders[0]?.orderNumber, "YS-20260823-ABC123");
    assert.equal(orders[0]?.items[0]?.productName, "Test Grocery");

    const historyRequest = requests.at(-1);
    assert.ok(historyRequest, "Expected customer order-history request.");
    assert.equal(new URL(historyRequest.url).pathname, "/api/customer-account/orders");
    assert.equal(historyRequest.init.method ?? "GET", "GET");
    assert.equal(historyRequest.init.credentials, "include");

    await customerAccountService.updateCustomerProfile({ name: "Maria Customer" });
    const profileRequest = requests.at(-1);
    assert.ok(profileRequest);
    assert.equal(new URL(profileRequest.url).pathname, "/api/customer-account/profile");
    assert.equal(profileRequest.init.method, "PATCH");
    assert.equal(profileRequest.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(profileRequest.init.body)), { name: "Maria Customer" });

    await customerAccountService.claimCustomerUsername({
      username: "maria.customer",
      currentPassword: "CustomerPass123!"
    });
    const usernameRequest = requests.at(-1);
    assert.ok(usernameRequest);
    assert.equal(
      new URL(usernameRequest.url).pathname,
      "/api/customer-account/username/claim"
    );
    assert.equal(usernameRequest.init.method, "POST");
    assert.equal(usernameRequest.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(usernameRequest.init.body)), {
      username: "maria.customer",
      currentPassword: "CustomerPass123!"
    });

    await customerAccountService.changeCustomerPassword({
      currentPassword: "CustomerPass123!",
      newPassword: "CustomerPass456!"
    });
    const passwordRequest = requests.at(-1);
    assert.ok(passwordRequest);
    assert.equal(
      new URL(passwordRequest.url).pathname,
      "/api/customer-account/password/change"
    );
    assert.equal(passwordRequest.init.method, "POST");
    assert.equal(passwordRequest.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(passwordRequest.init.body)), {
      currentPassword: "CustomerPass123!",
      newPassword: "CustomerPass456!"
    });

    const sessions = await customerAccountService.fetchCustomerSessions();
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.current, true);
    const sessionsRequest = requests.at(-1);
    assert.ok(sessionsRequest);
    assert.equal(new URL(sessionsRequest.url).pathname, "/api/customer-account/sessions");
    assert.equal(sessionsRequest.init.method, "GET");
    assert.equal(sessionsRequest.init.credentials, "include");

    const revocation = await customerAccountService.revokeOtherCustomerSessions(
      "CustomerPass123!"
    );
    assert.equal(revocation.revokedCount, 1);
    const revokeRequest = requests.at(-1);
    assert.ok(revokeRequest);
    assert.equal(
      new URL(revokeRequest.url).pathname,
      "/api/customer-account/sessions/revoke-others"
    );
    assert.equal(revokeRequest.init.method, "POST");
    assert.equal(revokeRequest.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(revokeRequest.init.body)), {
      currentPassword: "CustomerPass123!"
    });

    await storefrontService.placeStorefrontOrder({
      customerName: "Maria Customer",
      customerEmail: "maria@example.com",
      customerPhone: "09171234567",
      fulfillmentMethod: "STORE_PICKUP",
      paymentMethod: "CASH_ON_PICKUP",
      items: [{ productId: "product-1", quantity: 2 }]
    });

    const checkoutRequest = requests.at(-1);
    assert.ok(checkoutRequest, "Expected storefront checkout request.");
    assert.equal(new URL(checkoutRequest.url).pathname, "/api/storefront/orders");
    assert.equal(checkoutRequest.init.method, "POST");
    assert.equal(checkoutRequest.init.credentials, "include");
    assert.deepEqual(JSON.parse(String(checkoutRequest.init.body)), {
      customerName: "Maria Customer",
      customerEmail: "maria@example.com",
      customerPhone: "09171234567",
      fulfillmentMethod: "STORE_PICKUP",
      paymentMethod: "CASH_ON_PICKUP",
      items: [{ productId: "product-1", quantity: 2 }]
    });

    assert.deepEqual(
      accountStateModule.getCustomerCheckoutDefaults({
        id: "customer-1",
        name: "Maria Customer",
        username: null,
        email: "maria@example.com",
        phone: "09171234567",
        status: "ACTIVE"
      }),
      {
        customerName: "Maria Customer",
        customerEmail: "maria@example.com",
        customerPhone: "09171234567"
      }
    );
    assert.deepEqual(accountStateModule.getCustomerCheckoutDefaults(null), {
      customerName: "",
      customerEmail: "",
      customerPhone: ""
    });

    console.log("Customer account frontend contract passed.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
