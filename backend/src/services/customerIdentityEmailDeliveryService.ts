import { env } from "../config/env.js";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const DEVELOPMENT_RESEND_FROM_EMAIL = "onboarding@resend.dev";
const CUSTOMER_IDENTITY_FROM_NAME = "Ysabelle Store";

export type CustomerIdentityEmailPurpose = "registration" | "authentication";

export class CustomerIdentityEmailDeliveryError extends Error {
  public constructor() {
    super("Customer identity verification email delivery failed.");
    this.name = "CustomerIdentityEmailDeliveryError";
  }
}

type CustomerIdentityEmailDeliveryConfig = {
  apiKey?: string;
  from?: string;
  fetchImpl?: typeof fetch;
  nodeEnv?: "development" | "test" | "production";
  registrationDevOtpTo?: string;
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
  from = env.CUSTOMER_RECOVERY_FROM_EMAIL,
  fetchImpl = fetch,
  nodeEnv = env.NODE_ENV,
  registrationDevOtpTo = env.CUSTOMER_REGISTRATION_DEV_OTP_TO
}: CustomerIdentityEmailDeliveryConfig = {}) {
  return async (input: {
    to: string;
    verificationCode: string;
    purpose: CustomerIdentityEmailPurpose;
  }): Promise<void> => {
    if (nodeEnv === "test") return;

    const configuration = requireEmailConfiguration(apiKey, from);
    const deliveryTo =
      nodeEnv === "development" && registrationDevOtpTo?.trim()
        ? registrationDevOtpTo.trim()
        : input.to;
    const deliveryInput = { ...input, to: deliveryTo };
    let response: Response;

    try {
      response = await sendEmailRequest({ ...deliveryInput, ...configuration }, fetchImpl);
      if (
        !response.ok &&
        configuration.from !== DEVELOPMENT_RESEND_FROM_EMAIL &&
        (await isDevelopmentSenderRestriction(response, nodeEnv))
      ) {
        response = await sendEmailRequest(
          {
            ...deliveryInput,
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
