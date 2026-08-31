import assert from "node:assert/strict";
import test from "node:test";

type DevelopmentSmtpMessage = {
  appPassword: string;
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
  user: string;
};

type DeliveryModule = {
  createCustomerIdentityEmailDelivery?: (config: {
    apiKey?: string;
    developmentSmtpAppPassword?: string;
    developmentSmtpUser?: string;
    fetchImpl: typeof fetch;
    from?: string;
    nodeEnv?: "development" | "test" | "production";
    smtpSendImpl?: (message: DevelopmentSmtpMessage) => Promise<void>;
  }) => (input: {
    to: string;
    verificationCode: string;
    purpose: "registration" | "authentication";
  }) => Promise<void>;
  CustomerIdentityEmailDeliveryError: new () => Error;
};

async function loadDeliveryModule(): Promise<DeliveryModule> {
  return (await import("../src/services/customerIdentityEmailDeliveryService.js")) as DeliveryModule;
}

test("Resend registration delivery sends the Ysabelle-generated verification code", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);

  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const send = module.createCustomerIdentityEmailDelivery({
    apiKey: "re_test_key",
    from: "auth@example.com",
    nodeEnv: "production",
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  await send({
    to: "new.customer@example.com",
    verificationCode: "123456",
    purpose: "registration"
  });

  assert.equal(requestedUrl, "https://api.resend.com/emails");
  assert.equal(requestedInit?.method, "POST");
  const headers = new Headers(requestedInit?.headers);
  assert.equal(headers.get("authorization"), "Bearer re_test_key");
  const body = JSON.parse(String(requestedInit?.body)) as Record<string, unknown>;
  assert.equal(body.from, "Ysabelle Store <auth@example.com>");
  assert.deepEqual(body.to, ["new.customer@example.com"]);
  assert.equal(body.subject, "Verify your Ysabelle Store email");
  assert.match(String(body.text), /123456/);
  assert.match(String(body.html), /123456/);
});

test("development Gmail SMTP preserves actual recipients for registration and authentication", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);

  const smtpMessages: DevelopmentSmtpMessage[] = [];
  let resendCalled = false;
  const send = module.createCustomerIdentityEmailDelivery({
    apiKey: "re_test_key",
    from: "unverified@example.com",
    nodeEnv: "development",
    developmentSmtpUser: "qa.sender@gmail.com",
    developmentSmtpAppPassword: "app-password",
    smtpSendImpl: async (message) => {
      smtpMessages.push(message);
    },
    fetchImpl: async () => {
      resendCalled = true;
      return new Response(JSON.stringify({ id: "unexpected_resend_email" }), { status: 200 });
    }
  });

  await send({
    to: "brand.new.customer@gmail.com",
    verificationCode: "123456",
    purpose: "registration"
  });
  await send({
    to: "existing.customer@gmail.com",
    verificationCode: "654321",
    purpose: "authentication"
  });

  assert.equal(resendCalled, false);
  assert.deepEqual(
    smtpMessages.map((message) => message.to),
    ["brand.new.customer@gmail.com", "existing.customer@gmail.com"]
  );
  assert.equal(smtpMessages[0]?.from, "Ysabelle Store <qa.sender@gmail.com>");
  assert.equal(smtpMessages[0]?.subject, "Verify your Ysabelle Store email");
  assert.match(smtpMessages[0]?.text ?? "", /123456/);
  assert.equal(smtpMessages[1]?.subject, "Your Ysabelle Store sign-in code");
  assert.match(smtpMessages[1]?.text ?? "", /654321/);
});

test("Resend login delivery uses the authentication email copy", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);

  let body: Record<string, unknown> = {};
  const send = module.createCustomerIdentityEmailDelivery({
    apiKey: "re_test_key",
    from: "auth@example.com",
    nodeEnv: "production",
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ id: "email_456" }), { status: 200 });
    }
  });

  await send({
    to: "existing.customer@example.com",
    verificationCode: "654321",
    purpose: "authentication"
  });

  assert.equal(body.subject, "Your Ysabelle Store sign-in code");
  assert.match(String(body.text), /654321/);
});

test("Resend delivery fails closed when server credentials are missing", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);

  let fetchCalled = false;
  const send = module.createCustomerIdentityEmailDelivery({
    nodeEnv: "production",
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    }
  });

  await assert.rejects(
    () =>
      send({
        to: "customer@example.com",
        verificationCode: "123456",
        purpose: "authentication"
      }),
    (error: unknown) => error instanceof module.CustomerIdentityEmailDeliveryError
  );
  assert.equal(fetchCalled, false);
});

test("Resend delivery does not expose provider responses, API keys, or OTP values on failure", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);

  const send = module.createCustomerIdentityEmailDelivery({
    apiKey: "re_secret_key",
    from: "auth@example.com",
    nodeEnv: "production",
    fetchImpl: async () => new Response("provider failed re_secret_key otp 123456", { status: 500 })
  });

  await assert.rejects(
    () =>
      send({
        to: "customer@example.com",
        verificationCode: "123456",
        purpose: "authentication"
      }),
    (error: unknown) => {
      assert.ok(error instanceof module.CustomerIdentityEmailDeliveryError);
      assert.equal(error.message.includes("re_secret_key"), false);
      assert.equal(error.message.includes("123456"), false);
      assert.equal(error.message.includes("provider failed"), false);
      return true;
    }
  );
});
