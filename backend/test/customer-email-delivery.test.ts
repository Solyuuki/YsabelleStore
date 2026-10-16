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
    emailProvider?: "resend" | "gmail_smtp" | "gmail_api";
    gmailClientId?: string;
    gmailClientSecret?: string;
    gmailRefreshToken?: string;
    gmailSenderEmail?: string;
    smtpUser?: string;
    smtpAppPassword?: string;
    developmentSmtpAppPassword?: string;
    developmentSmtpUser?: string;
    fetchImpl: typeof fetch;
    from?: string;
    nodeEnv?: "development" | "test" | "production";
    smtpSendImpl?: (message: DevelopmentSmtpMessage) => Promise<void>;
  }) => (input: {
    to: string;
    verificationCode: string;
    purpose:
      | "registration"
      | "authentication"
      | "password_setup"
      | "password_recovery"
      | "session_security";
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

test("development Gmail SMTP sends password recovery codes through the shared identity delivery path", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);

  const smtpMessages: DevelopmentSmtpMessage[] = [];
  const send = module.createCustomerIdentityEmailDelivery({
    nodeEnv: "development",
    developmentSmtpUser: "qa.sender@gmail.com",
    developmentSmtpAppPassword: "app-password",
    smtpSendImpl: async (message) => {
      smtpMessages.push(message);
    },
    fetchImpl: async () => {
      throw new Error("Resend should not be called when development Gmail SMTP is configured.");
    }
  });

  await send({
    to: "recovering.customer@gmail.com",
    verificationCode: "246810",
    purpose: "password_recovery"
  });

  assert.equal(smtpMessages.length, 1);
  assert.equal(smtpMessages[0]?.to, "recovering.customer@gmail.com");
  assert.equal(smtpMessages[0]?.subject, "Your Ysabelle Store password recovery code");
  assert.match(smtpMessages[0]?.text ?? "", /246810/);
  assert.match(smtpMessages[0]?.html ?? "", /246810/);
});

test("production Gmail SMTP delivers OTP and recovery codes without calling Resend", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);

  const sent: DevelopmentSmtpMessage[] = [];
  const send = module.createCustomerIdentityEmailDelivery({
    nodeEnv: "production",
    emailProvider: "gmail_smtp",
    apiKey: "re_unused_key",
    smtpUser: "ysabellestore.support@gmail.com",
    smtpAppPassword: "app-password",
    smtpSendImpl: async (message) => {
      sent.push(message);
    },
    fetchImpl: async () => {
      throw new Error("Resend must not be used when production Gmail SMTP is selected.");
    }
  });

  await send({ to: "otp@example.com", verificationCode: "123456", purpose: "authentication" });
  await send({
    to: "recovery@example.com",
    verificationCode: "654321",
    purpose: "password_recovery"
  });

  assert.deepEqual(sent.map((message) => message.to), ["otp@example.com", "recovery@example.com"]);
  assert.ok(sent.every((message) => message.user === "ysabellestore.support@gmail.com"));
  assert.equal(sent[0]?.from, "Ysabelle Store <ysabellestore.support@gmail.com>");
  assert.match(sent[0]?.text ?? "", /123456/);
  assert.match(sent[1]?.text ?? "", /654321/);
});

test("production Gmail SMTP fails closed without credentials instead of falling back to Resend", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);
  let resendCalled = false;
  const send = module.createCustomerIdentityEmailDelivery({
    nodeEnv: "production",
    emailProvider: "gmail_smtp",
    apiKey: "re_unused_key",
    smtpUser: "",
    smtpAppPassword: "",
    developmentSmtpUser: "",
    developmentSmtpAppPassword: "",
    fetchImpl: async () => {
      resendCalled = true;
      return new Response("{}", { status: 200 });
    }
  });

  await assert.rejects(
    () => send({ to: "otp@example.com", verificationCode: "123456", purpose: "authentication" }),
    (error: unknown) => error instanceof module.CustomerIdentityEmailDeliveryError
  );
  assert.equal(resendCalled, false);
});

test("production Gmail SMTP errors never expose credentials or OTP and never silently use Resend", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);
  let resendCalled = false;
  const send = module.createCustomerIdentityEmailDelivery({
    nodeEnv: "production",
    emailProvider: "gmail_smtp",
    smtpUser: "sender@gmail.com",
    smtpAppPassword: "super-secret-app-password",
    smtpSendImpl: async () => {
      throw new Error("super-secret-app-password 123456 provider error");
    },
    fetchImpl: async () => {
      resendCalled = true;
      return new Response("{}", { status: 200 });
    }
  });

  await assert.rejects(
    () => send({ to: "otp@example.com", verificationCode: "123456", purpose: "authentication" }),
    (error: unknown) => {
      assert.ok(error instanceof module.CustomerIdentityEmailDeliveryError);
      assert.equal(error.message.includes("super-secret"), false);
      assert.equal(error.message.includes("123456"), false);
      return true;
    }
  );
  assert.equal(resendCalled, false);
});

test("production Gmail API delivers OTP and recovery codes over HTTPS", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const send = module.createCustomerIdentityEmailDelivery({
    nodeEnv: "production",
    emailProvider: "gmail_api",
    gmailClientId: "google-client",
    gmailClientSecret: "google-secret",
    gmailRefreshToken: "refresh-token",
    gmailSenderEmail: "ysabellestore.support@gmail.com",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url) === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "short-lived-access-token" }), {
          status: 200
        });
      }
      if (String(url) === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") {
        return new Response(JSON.stringify({ id: "sent" }), { status: 200 });
      }
      throw new Error("Unexpected request");
    }
  });

  await send({ to: "customer@example.com", verificationCode: "123456", purpose: "authentication" });
  await send({
    to: "recovery@example.com",
    verificationCode: "654321",
    purpose: "password_recovery"
  });

  const sends = requests.filter((request) => request.url.endsWith("/messages/send"));
  assert.equal(sends.length, 2);
  assert.equal(requests.filter((request) => request.url.endsWith("/token")).length, 2);
  assert.ok(requests.every((request) => !request.url.includes("resend.com")));
  const rawEmails = sends.map((request) => {
    const payload = JSON.parse(String(request.init?.body)) as { raw: string };
    return Buffer.from(payload.raw, "base64url").toString("utf8");
  });
  assert.match(rawEmails[0] ?? "", /To: customer@example.com/);
  assert.match(rawEmails[0] ?? "", /From: Ysabelle Store <ysabellestore.support@gmail.com>/);
  assert.match(rawEmails[0] ?? "", /Subject: Your Ysabelle Store sign-in code/);
  assert.match(rawEmails[1] ?? "", /Subject: Your Ysabelle Store password recovery code/);
  const decodeText = (raw: string) => {
    const encoded = raw.split("Content-Transfer-Encoding: base64")[1]?.split("--")[0]?.trim();
    return Buffer.from(encoded ?? "", "base64").toString("utf8");
  };
  assert.match(decodeText(rawEmails[0] ?? ""), /123456/);
  assert.match(decodeText(rawEmails[1] ?? ""), /654321/);
});

test("production Gmail API fails closed on expired OAuth grants without leaking secrets", async () => {
  const module = await loadDeliveryModule();
  assert.ok(module.createCustomerIdentityEmailDelivery);
  let sendCalled = false;
  const send = module.createCustomerIdentityEmailDelivery({
    nodeEnv: "production",
    emailProvider: "gmail_api",
    gmailClientId: "google-client",
    gmailClientSecret: "sensitive-client-secret",
    gmailRefreshToken: "sensitive-refresh-token",
    gmailSenderEmail: "ysabellestore.support@gmail.com",
    fetchImpl: async (url) => {
      if (String(url).endsWith("/messages/send")) sendCalled = true;
      return new Response("invalid_grant sensitive-refresh-token", { status: 400 });
    }
  });

  await assert.rejects(
    () => send({ to: "customer@example.com", verificationCode: "123456", purpose: "authentication" }),
    (error: unknown) => {
      assert.ok(error instanceof module.CustomerIdentityEmailDeliveryError);
      assert.doesNotMatch(error.message, /sensitive|123456|invalid_grant/);
      return true;
    }
  );
  assert.equal(sendCalled, false);
});
