import assert from "node:assert/strict";
import test from "node:test";

type MobileSmsInput = {
  phone: string;
  verificationCode: string;
};

type DeliveryFactory = (config: {
  apiKey?: string;
  senderName?: string;
  fetchImpl: typeof fetch;
}) => (input: MobileSmsInput) => Promise<void>;

type DeliveryModule = {
  createCustomerMobileSmsDelivery: DeliveryFactory;
  CustomerMobileSmsDeliveryError: new () => Error;
};

async function loadDeliveryModule(): Promise<DeliveryModule | null> {
  const modulePath = "../src/services/customerMobileSmsDeliveryService.js";
  try {
    return (await import(modulePath)) as DeliveryModule;
  } catch {
    return null;
  }
}

test("Semaphore OTP delivery sends the Ysabelle-generated code to the PH OTP endpoint", async () => {
  const deliveryModule = await loadDeliveryModule();
  assert.ok(deliveryModule, "Expected the Semaphore mobile SMS delivery service to exist.");

  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const send = deliveryModule.createCustomerMobileSmsDelivery({
    apiKey: "phase7-test-api-key",
    senderName: "YSABELLE",
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return new Response(
        JSON.stringify([
          {
            message_id: 12345,
            recipient: "639171234567",
            code: 123456,
            sender_name: "YSABELLE",
            network: "Globe",
            status: "Pending"
          }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
  });

  await send({ phone: "+639171234567", verificationCode: "123456" });

  assert.equal(requestedUrl, "https://api.semaphore.co/api/v4/otp");
  assert.equal(requestedInit?.method, "POST");
  const body = new URLSearchParams(String(requestedInit?.body ?? ""));
  assert.equal(body.get("apikey"), "phase7-test-api-key");
  assert.equal(body.get("number"), "639171234567");
  assert.equal(
    body.get("message"),
    "Ysabelle Store code: {otp}. Expires in 10 minutes. Do not share this code."
  );
  assert.equal(body.get("code"), "123456");
  assert.equal(body.get("sendername"), "YSABELLE");
});

test("Semaphore OTP delivery fails closed when server credentials are missing", async () => {
  const deliveryModule = await loadDeliveryModule();
  assert.ok(deliveryModule, "Expected the Semaphore mobile SMS delivery service to exist.");

  let fetchCalled = false;
  const send = deliveryModule.createCustomerMobileSmsDelivery({
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response("[]", { status: 200 });
    }
  });

  await assert.rejects(
    () => send({ phone: "+639171234567", verificationCode: "123456" }),
    (error: unknown) => error instanceof deliveryModule.CustomerMobileSmsDeliveryError
  );
  assert.equal(fetchCalled, false);
});

test("Semaphore OTP delivery does not expose provider bodies, API keys, or OTP values on failure", async () => {
  const deliveryModule = await loadDeliveryModule();
  assert.ok(deliveryModule, "Expected the Semaphore mobile SMS delivery service to exist.");

  const send = deliveryModule.createCustomerMobileSmsDelivery({
    apiKey: "phase7-secret-api-key",
    fetchImpl: async () =>
      new Response("provider failure phase7-secret-api-key code 123456", { status: 500 })
  });

  await assert.rejects(
    () => send({ phone: "+639171234567", verificationCode: "123456" }),
    (error: unknown) => {
      assert.ok(error instanceof deliveryModule.CustomerMobileSmsDeliveryError);
      assert.equal(error.message.includes("phase7-secret-api-key"), false);
      assert.equal(error.message.includes("123456"), false);
      assert.equal(error.message.includes("provider failure"), false);
      return true;
    }
  );
});

test("Semaphore OTP delivery rejects malformed success payloads", async () => {
  const deliveryModule = await loadDeliveryModule();
  assert.ok(deliveryModule, "Expected the Semaphore mobile SMS delivery service to exist.");

  const send = deliveryModule.createCustomerMobileSmsDelivery({
    apiKey: "phase7-test-api-key",
    fetchImpl: async () => new Response("[]", { status: 200 })
  });

  await assert.rejects(
    () => send({ phone: "+639171234567", verificationCode: "123456" }),
    (error: unknown) => error instanceof deliveryModule.CustomerMobileSmsDeliveryError
  );
});
