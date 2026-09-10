import { once } from "node:events";
import { connect as connectTls, type TLSSocket } from "node:tls";

import { env } from "../config/env.js";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const DEVELOPMENT_RESEND_FROM_EMAIL = "onboarding@resend.dev";
const CUSTOMER_IDENTITY_FROM_NAME = "Ysabelle Store";
const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;
const SMTP_TIMEOUT_MS = 15_000;

export type CustomerIdentityEmailPurpose = "registration" | "authentication";

export class CustomerIdentityEmailDeliveryError extends Error {
  public constructor() {
    super("Customer identity verification email delivery failed.");
    this.name = "CustomerIdentityEmailDeliveryError";
  }
}

type DevelopmentSmtpMessage = {
  appPassword: string;
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
  user: string;
};

type CustomerIdentityEmailDeliveryConfig = {
  apiKey?: string;
  developmentSmtpAppPassword?: string;
  developmentSmtpUser?: string;
  fetchImpl?: typeof fetch;
  from?: string;
  nodeEnv?: "development" | "test" | "production";
  smtpSendImpl?: (message: DevelopmentSmtpMessage) => Promise<void>;
};

type SmtpResponse = {
  code: number;
  text: string;
};

function requireEmailConfiguration(apiKey: string | undefined, from: string | undefined) {
  const resolvedApiKey = apiKey?.trim();
  const resolvedFrom = from?.trim();
  if (!resolvedApiKey || !resolvedFrom) throw new CustomerIdentityEmailDeliveryError();
  return { apiKey: resolvedApiKey, from: resolvedFrom };
}

function formatFromAddress(email: string) {
  return `${CUSTOMER_IDENTITY_FROM_NAME} <${email}>`;
}

function emailCopy(purpose: CustomerIdentityEmailPurpose, verificationCode: string) {
  const title =
    purpose === "registration" ? "Verify your email address" : "Sign in to Ysabelle Store";
  const description =
    purpose === "registration"
      ? "Use this one-time code to verify the email address for your new customer account."
      : "Use this one-time code to sign in to your customer account.";
  const subject =
    purpose === "registration"
      ? "Verify your Ysabelle Store email"
      : "Your Ysabelle Store sign-in code";

  const text = [
    `Ysabelle Store - ${title}`,
    "",
    `Your verification code is: ${verificationCode}`,
    "",
    "This code expires in 10 minutes and can only be used once.",
    "Do not share this code with anyone."
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f7f7ff;font-family:Inter,Arial,sans-serif;color:#17162b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:linear-gradient(135deg,#f7f7ff,#fff5fc)">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e8e4ff;border-radius:24px;padding:32px;box-shadow:0 18px 50px rgba(74,58,130,.12)">
          <tr><td>
            <div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6757d9">Ysabelle Store</div>
            <h1 style="font-size:28px;line-height:1.2;margin:14px 0 10px">${title}</h1>
            <p style="font-size:15px;line-height:1.7;color:#5f5a75;margin:0 0 24px">${description}</p>
            <div style="display:inline-block;padding:14px 20px;border-radius:14px;background:linear-gradient(135deg,#edf4ff,#f5efff,#fff0f8);border:1px solid #ddd5ff;font-size:30px;line-height:1;font-weight:900;letter-spacing:.24em;color:#272244">${verificationCode}</div>
            <p style="font-size:13px;line-height:1.7;color:#77728c;margin:24px 0 0">This code expires in 10 minutes and can only be used once. Do not share it with anyone.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { html, subject, text };
}

function createSmtpResponseReader(socket: TLSSocket) {
  let buffer = "";
  let responseLines: string[] = [];
  const ready: SmtpResponse[] = [];
  const waiters: Array<{
    resolve: (response: SmtpResponse) => void;
    reject: (error: Error) => void;
  }> = [];

  function rejectWaiters(error: Error) {
    while (waiters.length > 0) waiters.shift()?.reject(error);
  }

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    while (true) {
      const lineEnd = buffer.indexOf("\n");
      if (lineEnd < 0) break;
      const line = buffer.slice(0, lineEnd + 1).replace(/\r?\n$/, "");
      buffer = buffer.slice(lineEnd + 1);
      responseLines.push(line);

      const match = /^(\d{3})([ -])/.exec(line);
      if (!match || match[2] !== " ") continue;

      const response = { code: Number(match[1]), text: responseLines.join("\n") };
      responseLines = [];
      const waiter = waiters.shift();
      if (waiter) waiter.resolve(response);
      else ready.push(response);
    }
  });
  socket.on("error", (error) => rejectWaiters(error));
  socket.on("timeout", () => rejectWaiters(new Error("SMTP connection timed out.")));

  return () =>
    new Promise<SmtpResponse>((resolve, reject) => {
      const response = ready.shift();
      if (response) resolve(response);
      else waiters.push({ resolve, reject });
    });
}

async function expectSmtpResponse(
  readResponse: () => Promise<SmtpResponse>,
  expectedCodes: number[]
) {
  const response = await readResponse();
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`Unexpected SMTP response: ${response.code}`);
  }
}

function normalizeSmtpBody(value: string) {
  return value
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

async function sendGmailSmtpMessage(message: DevelopmentSmtpMessage): Promise<void> {
  const socket = connectTls({
    host: GMAIL_SMTP_HOST,
    port: GMAIL_SMTP_PORT,
    servername: GMAIL_SMTP_HOST,
    rejectUnauthorized: true
  });
  socket.setTimeout(SMTP_TIMEOUT_MS);
  const readResponse = createSmtpResponseReader(socket);

  try {
    await once(socket, "secureConnect");
    await expectSmtpResponse(readResponse, [220]);

    socket.write("EHLO localhost\r\n");
    await expectSmtpResponse(readResponse, [250]);

    const authPayload = Buffer.from(`\0${message.user}\0${message.appPassword}`, "utf8").toString(
      "base64"
    );
    socket.write(`AUTH PLAIN ${authPayload}\r\n`);
    await expectSmtpResponse(readResponse, [235]);

    socket.write(`MAIL FROM:<${message.user}>\r\n`);
    await expectSmtpResponse(readResponse, [250]);

    socket.write(`RCPT TO:<${message.to}>\r\n`);
    await expectSmtpResponse(readResponse, [250, 251]);

    socket.write("DATA\r\n");
    await expectSmtpResponse(readResponse, [354]);

    const boundary = "ysabelle-store-otp";
    const rawMessage = [
      `From: ${message.from}`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      message.text,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      message.html,
      `--${boundary}--`,
      ""
    ].join("\r\n");
    socket.write(`${normalizeSmtpBody(rawMessage)}\r\n.\r\n`);
    await expectSmtpResponse(readResponse, [250]);

    socket.write("QUIT\r\n");
    await expectSmtpResponse(readResponse, [221]);
  } finally {
    socket.end();
    socket.destroy();
  }
}

async function sendEmailRequest(
  input: {
    apiKey: string;
    from: string;
    to: string;
    verificationCode: string;
    purpose: CustomerIdentityEmailPurpose;
  },
  fetchImpl: typeof fetch
) {
  const { html, subject, text } = emailCopy(input.purpose, input.verificationCode);
  return fetchImpl(RESEND_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
      "user-agent": "YsabelleStore/customer-identity"
    },
    body: JSON.stringify({
      from: formatFromAddress(input.from),
      to: [input.to],
      subject,
      html,
      text
    })
  });
}

async function isDevelopmentSenderRestriction(
  response: Response,
  nodeEnv: "development" | "test" | "production"
): Promise<boolean> {
  if (response.status !== 403 || nodeEnv === "production") return false;

  let body = "";
  try {
    body = await response.clone().text();
  } catch {
    return false;
  }

  return /domain.*not verified|verify a domain|testing emails/i.test(body);
}

export function createCustomerIdentityEmailDelivery({
  apiKey = env.RESEND_API_KEY,
  developmentSmtpAppPassword = env.CUSTOMER_DEV_GMAIL_SMTP_APP_PASSWORD,
  developmentSmtpUser = env.CUSTOMER_DEV_GMAIL_SMTP_USER,
  fetchImpl = fetch,
  from = env.CUSTOMER_RECOVERY_FROM_EMAIL,
  nodeEnv = env.NODE_ENV,
  smtpSendImpl = sendGmailSmtpMessage
}: CustomerIdentityEmailDeliveryConfig = {}) {
  return async (input: {
    to: string;
    verificationCode: string;
    purpose: CustomerIdentityEmailPurpose;
  }): Promise<void> => {
    if (nodeEnv === "test") return;

    const smtpUser = developmentSmtpUser?.trim();
    const smtpAppPassword = developmentSmtpAppPassword?.replace(/\s+/g, "").trim();
    if (nodeEnv === "development" && (smtpUser || smtpAppPassword)) {
      if (!smtpUser || !smtpAppPassword) throw new CustomerIdentityEmailDeliveryError();
      const { html, subject, text } = emailCopy(input.purpose, input.verificationCode);
      try {
        await smtpSendImpl({
          appPassword: smtpAppPassword,
          from: formatFromAddress(smtpUser),
          html,
          subject,
          text,
          to: input.to,
          user: smtpUser
        });
        return;
      } catch {
        throw new CustomerIdentityEmailDeliveryError();
      }
    }

    const configuration = requireEmailConfiguration(apiKey, from);
    let response: Response;

    try {
      response = await sendEmailRequest({ ...input, ...configuration }, fetchImpl);
      if (
        !response.ok &&
        configuration.from !== DEVELOPMENT_RESEND_FROM_EMAIL &&
        (await isDevelopmentSenderRestriction(response, nodeEnv))
      ) {
        response = await sendEmailRequest(
          {
            ...input,
            apiKey: configuration.apiKey,
            from: DEVELOPMENT_RESEND_FROM_EMAIL
          },
          fetchImpl
        );
      }
    } catch {
      throw new CustomerIdentityEmailDeliveryError();
    }

    if (!response.ok) throw new CustomerIdentityEmailDeliveryError();
  };
}

export const sendCustomerIdentityVerificationEmail = createCustomerIdentityEmailDelivery();
