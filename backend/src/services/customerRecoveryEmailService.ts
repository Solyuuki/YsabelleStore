import { env } from "../config/env.js";
import type { CustomerRecoveryEmailDelivery } from "./customerPasswordRecoveryService.js";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const DEVELOPMENT_RESEND_FROM_EMAIL = "onboarding@resend.dev";
const CUSTOMER_RECOVERY_FROM_NAME = "Ysabelle Store";

export class CustomerRecoveryEmailDeliveryError extends Error {
  constructor() {
    super("Customer recovery email delivery failed.");
    this.name = "CustomerRecoveryEmailDeliveryError";
  }
}

function requireRecoveryEmailConfiguration() {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.CUSTOMER_RECOVERY_FROM_EMAIL?.trim();

  if (!apiKey || !from) throw new CustomerRecoveryEmailDeliveryError();
  return { apiKey, from };
}

function formatRecoveryFromAddress(email: string) {
  return `${CUSTOMER_RECOVERY_FROM_NAME} <${email}>`;
}

function recoveryEmailContent(verificationCode: string) {
  const text = [
    "Ysabelle Store password recovery",
    "",
    `Your verification code is: ${verificationCode}`,
    "",
    "This code expires in 10 minutes and can only be used once.",
    "Do not share this code with anyone.",
    "If you did not request this change, you can ignore this message."
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f7f7ff;font-family:Inter,Arial,sans-serif;color:#17162b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:linear-gradient(135deg,#f7f7ff,#fff5fc)">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e8e4ff;border-radius:24px;padding:32px;box-shadow:0 18px 50px rgba(74,58,130,.12)">
          <tr><td>
            <div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6757d9">Ysabelle Store</div>
            <h1 style="font-size:28px;line-height:1.2;margin:14px 0 10px">Verify your recovery request</h1>
            <p style="font-size:15px;line-height:1.7;color:#5f5a75;margin:0 0 24px">Use this one-time verification code to continue resetting your customer account password.</p>
            <div style="display:inline-block;padding:14px 20px;border-radius:14px;background:linear-gradient(135deg,#edf4ff,#f5efff,#fff0f8);border:1px solid #ddd5ff;font-size:30px;line-height:1;font-weight:900;letter-spacing:.24em;color:#272244">${verificationCode}</div>
            <p style="font-size:13px;line-height:1.7;color:#77728c;margin:24px 0 0">This code expires in 10 minutes and can only be used once. Do not share it with anyone. If you did not request a password reset, ignore this email and your current password will remain unchanged.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

async function sendRecoveryEmailRequest(input: {
  apiKey: string;
  from: string;
  to: string;
  verificationCode: string;
}): Promise<Response> {
  const { html, text } = recoveryEmailContent(input.verificationCode);
  return fetch(RESEND_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
      "user-agent": "YsabelleStore/customer-recovery"
    },
    body: JSON.stringify({
      from: formatRecoveryFromAddress(input.from),
      to: [input.to],
      subject: "Your Ysabelle Store verification code",
      html,
      text
    })
  });
}

async function isDevelopmentSenderRestriction(response: Response): Promise<boolean> {
  if (response.status !== 403 || env.NODE_ENV === "production") return false;

  let body = "";
  try {
    body = await response.clone().text();
  } catch {
    return false;
  }

  return /domain.*not verified|verify a domain|testing emails/i.test(body);
}

export const customerRecoveryEmailDelivery: CustomerRecoveryEmailDelivery = {
  async sendPasswordRecoveryEmail({ to, verificationCode }) {
    const { apiKey, from } = requireRecoveryEmailConfiguration();

    let response: Response;
    try {
      response = await sendRecoveryEmailRequest({ apiKey, from, to, verificationCode });

      if (
        !response.ok &&
        from !== DEVELOPMENT_RESEND_FROM_EMAIL &&
        (await isDevelopmentSenderRestriction(response))
      ) {
        console.warn(
          JSON.stringify({
            event: "customer_recovery_sender_fallback",
            reason: "development_sender_rejected"
          })
        );
        response = await sendRecoveryEmailRequest({
          apiKey,
          from: DEVELOPMENT_RESEND_FROM_EMAIL,
          to,
          verificationCode
        });
      }
    } catch {
      throw new CustomerRecoveryEmailDeliveryError();
    }

    if (!response.ok) throw new CustomerRecoveryEmailDeliveryError();
  }
};
