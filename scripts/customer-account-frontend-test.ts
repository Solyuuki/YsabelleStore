import assert from "node:assert/strict";

async function main() {
  const storefrontService = await import("../frontend/src/services/storefrontService.ts");
  const accountStateModule = await import("../frontend/src/utils/customerAccountState.ts").catch(
    () => null
  );

  assert.equal(
    typeof storefrontService.fetchCustomerOrders,
    "function",
    "Expected fetchCustomerOrders to exist."
  );
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Customer orders loaded.",
        data: url.endsWith("/api/customer-account/orders") ? [order] : order
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
