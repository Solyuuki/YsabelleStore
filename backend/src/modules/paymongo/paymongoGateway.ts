import { createHmac, timingSafeEqual } from "node:crypto";

import { HttpError } from "../../utils/httpError.js";

const PAYMONGO_CHECKOUT_API = "https://api.paymongo.com/v2/checkout_sessions";

export type PaymongoLineItem = {
  name: string;
  amount: number;
  currency: "PHP";
  quantity: number;
};

type CheckoutSession = {
  data?: {
    id?: string;
    attributes?: {
      checkout_url?: string;
      livemode?: boolean;
      reference_number?: string;
    };
  };
};

export function paymongoTestKey() {
  const key = process.env.PAYMONGO_SECRET_KEY?.trim();
  if (!key || !key.startsWith("sk_test_")) {
    throw new HttpError(503, "PayMongo test checkout is not configured.", {
      code: "PAYMONGO_TEST_MODE_REQUIRED"
    });
  }
  return key;
}

export async function createPaymongoTestCheckout(input: {
  lineItems: PaymongoLineItem[];
  orderNumber: string;
  successUrl: string;
  cancelUrl: string;
  billing: { name: string; email?: string; phone: string };
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const key = paymongoTestKey();
  if (!input.lineItems.length || input.lineItems.some((item) =>
    !Number.isSafeInteger(item.amount) || item.amount <= 0 ||
    !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
    item.currency !== "PHP"
  )) {
    throw new HttpError(422, "Invalid checkout line items.", {
      code: "PAYMONGO_INVALID_LINE_ITEMS"
    });
  }

  const response = await fetch(PAYMONGO_CHECKOUT_API, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "content-type": "application/json",
      "idempotency-key": `ysabelle-paymongo-${input.orderNumber}`
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: input.lineItems,
          payment_method_types: ["card", "gcash", "qrph"],
          reference_number: input.orderNumber,
          description: `Ysabelle Store test order ${input.orderNumber}`,
          billing: {
            name: input.billing.name,
            ...(input.billing.email ? { email: input.billing.email } : {}),
            phone: input.billing.phone
          },
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          send_email_receipt: false,
          show_line_items: true
        }
      }
    }),
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    throw new HttpError(502, "The PayMongo test checkout service is unavailable.", {
      code: "PAYMONGO_CHECKOUT_FAILED"
    });
  }
  const payload = (await response.json()) as CheckoutSession;
  const sessionId = payload.data?.id;
  const checkoutUrl = payload.data?.attributes?.checkout_url;
  if (
    payload.data?.attributes?.livemode !== false ||
    !sessionId?.startsWith("cs_") ||
    !checkoutUrl
  ) {
    throw new HttpError(502, "PayMongo returned an invalid test checkout.", {
      code: "PAYMONGO_INVALID_RESPONSE"
    });
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(checkoutUrl);
  } catch {
    throw new HttpError(502, "PayMongo returned an invalid checkout URL.", {
      code: "PAYMONGO_INVALID_RESPONSE"
    });
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "checkout.paymongo.com") {
    throw new HttpError(502, "PayMongo returned an untrusted checkout URL.", {
      code: "PAYMONGO_INVALID_RESPONSE"
    });
  }
  return { sessionId, checkoutUrl };
}

/** Verify PayMongo's test-mode HMAC over timestamp + '.' + *raw* request body. */
export function verifyPaymongoTestSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  webhookSecret: string,
  now = Date.now()
): boolean {
  if (!webhookSecret || !signatureHeader) return false;
  const fields = new Map(
    signatureHeader.split(",").map((entry) => {
      const delimiter = entry.indexOf("=");
      return [entry.slice(0, delimiter).trim(), entry.slice(delimiter + 1).trim()];
    })
  );
  const timestamp = fields.get("t");
  const signature = fields.get("te");
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  if (Math.abs(now - Number(timestamp) * 1000) > 5 * 60 * 1000) return false;
  const expected = createHmac("sha256", webhookSecret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest();
  const provided = Buffer.from(signature, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
