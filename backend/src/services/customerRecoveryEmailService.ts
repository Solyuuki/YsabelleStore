import { env } from "../config/env.js";
import type { CustomerRecoveryEmailDelivery } from "./customerPasswordRecoveryService.js";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";

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

function recoveryEmailContent(recoveryUrl: string) {
  const text = [
    "Ysabelle Store password recovery",
    "",
    "We received a request to reset your customer account password.",
    `Reset your password: ${recoveryUrl}`,
    "",
    "This recovery link expires in 15 minutes and can only be used once.",
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
            <h1 style="font-size:28px;line-height:1.2;margin:14px 0 10px">Reset your password</h1>
            <p style="font-size:15px;line-height:1.7;color:#5f5a75;margin:0 0 24px">We received a request to reset your customer account password. Use the secure link below within 15 minutes.</p>
            <a href="${recoveryUrl}" style="display:inline-block;padding:13px 20px;border-radius:14px;background:linear-gradient(135deg,#4d7cff,#7a5cff,#ec5da8);color:#ffffff;text-decoration:none;font-weight:800">Reset password</a>
            <p style="font-size:13px;line-height:1.7;color:#77728c;margin:24px 0 0">This link is single-use. If you did not request a password reset, ignore this email and your current password will remain unchanged.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

export const customerRecoveryEmailDelivery: CustomerRecoveryEmailDelivery = {
  async sendPasswordRecoveryEmail({ to, recoveryUrl }) {
    const { apiKey, from } = requireRecoveryEmailConfiguration();
    const { html, text } = recoveryEmailContent(recoveryUrl);

    let response: Response;
    try {
      response = await fetch(RESEND_EMAIL_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: "Reset your Ysabelle Store password",
          html,
          text
        })
      });
    } catch {
      throw new CustomerRecoveryEmailDeliveryError();
    }

    if (!response.ok) throw new CustomerRecoveryEmailDeliveryError();
  }
};
