import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, test } from "node:test";

import {
  createPaymongoTestCheckout,
  paymongoTestKey,
  verifyPaymongoTestSignature
} from "../src/modules/paymongo/paymongoGateway.js";

const originalKey = process.env.PAYMONGO_SECRET_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
  else process.env.PAYMONGO_SECRET_KEY = originalKey;
  globalThis.fetch = originalFetch;
});

test("PayMongo integration rejects live keys and missing keys", () => {
  delete process.env.PAYMONGO_SECRET_KEY;
  assert.throws(() => paymongoTestKey(), /test checkout is not configured/);
  process.env.PAYMONGO_SECRET_KEY = "sk_live_never_accept";
  assert.throws(() => paymongoTestKey(), /test checkout is not configured/);
  process.env.PAYMONGO_SECRET_KEY = "sk_test_example";
  assert.equal(paymongoTestKey(), "sk_test_example");
});

test("PayMongo signature validates raw payload and disallows replay/tampering", () => {
  const secret = "test-webhook-secret";
  const timestamp = "1789819200";
  const body = Buffer.from('{"data":{"type":"checkout_session.payment.paid"}}');
  const signature = createHmac("sha256", secret)
    .update(timestamp).update(".").update(body).digest("hex");
  const header = `t=${timestamp},te=${signature},li=`;
  const now = Number(timestamp) * 1000;
  assert.equal(verifyPaymongoTestSignature(body, header, secret, now), true);
  assert.equal(verifyPaymongoTestSignature(Buffer.from("{}"), header, secret, now), false);
  assert.equal(verifyPaymongoTestSignature(body, header, secret, now + 301_000), false);
  assert.equal(verifyPaymongoTestSignature(body, `t=${timestamp},te=abc,li=`, secret, now), false);
  assert.equal(verifyPaymongoTestSignature(body, `t=${timestamp},te=,li=${signature}`, secret, now), false);
});

test("Checkout is created on v2 with PHP centavos, test-key Basic auth and validated host", async () => {
  process.env.PAYMONGO_SECRET_KEY = "sk_test_example";
  let requestUrl = "";
  let requestOptions: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestOptions = init;
    return new Response(JSON.stringify({
      data: {
        id: "cs_test_123",
        attributes: {
          livemode: false,
          checkout_url: "https://checkout.paymongo.com/cs_test_123"
        }
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const result = await createPaymongoTestCheckout({
    orderNumber: "YS-TEST-123",
    lineItems: [{ name: "Rice", amount: 12550, currency: "PHP", quantity: 2 }],
    successUrl: "http://localhost:5173/order-success",
    cancelUrl: "http://localhost:5173/cart",
    billing: { name: "Test Customer", email: "test@example.com", phone: "09123456789" }
  });
  assert.equal(requestUrl, "https://api.paymongo.com/v2/checkout_sessions");
  assert.equal(requestOptions?.method, "POST");
  const headers = requestOptions?.headers as Record<string, string>;
  assert.equal(headers.authorization, `Basic ${Buffer.from("sk_test_example:").toString("base64")}`);
  assert.equal(headers["idempotency-key"], "ysabelle-paymongo-YS-TEST-123");
  const body = JSON.parse(String(requestOptions?.body));
  assert.equal(body.data.attributes.line_items[0].amount, 12550);
  assert.equal(body.data.attributes.reference_number, "YS-TEST-123");
  assert.deepEqual(result, {
    sessionId: "cs_test_123",
    checkoutUrl: "https://checkout.paymongo.com/cs_test_123"
  });
});

test("Checkout rejects live-mode responses and untrusted redirect hosts", async () => {
  process.env.PAYMONGO_SECRET_KEY = "sk_test_example";
  const input = {
    orderNumber: "YS-TEST-124",
    lineItems: [{ name: "Rice", amount: 10000, currency: "PHP" as const, quantity: 1 }],
    successUrl: "http://localhost:5173/order-success",
    cancelUrl: "http://localhost:5173/cart",
    billing: { name: "Test Customer", phone: "09123456789" }
  };
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: { id: "cs_123", attributes: { livemode: true, checkout_url: "https://checkout.paymongo.com/cs_123" } }
  }), { status: 200 });
  await assert.rejects(createPaymongoTestCheckout(input), /invalid test checkout/);
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: { id: "cs_123", attributes: { livemode: false, checkout_url: "https://evil.example/checkout" } }
  }), { status: 200 });
  await assert.rejects(createPaymongoTestCheckout(input), /untrusted checkout URL/);
});
