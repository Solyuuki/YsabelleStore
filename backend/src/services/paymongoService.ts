import { createHmac, timingSafeEqual } from "node:crypto";

import { CustomerPaymentMethod, CustomerPaymentStatus, Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";

const PAYMONGO_API_ORIGIN = "https://api.paymongo.com";
const PAYMONGO_CREATE_CHECKOUT_PATH = "/v2/checkout_sessions";
const PAYMONGO_RETRIEVE_CHECKOUT_PATH = "/v1/checkout_sessions";
const PAYMONGO_CURRENCY = "PHP";

type JsonRecord = Record<string, unknown>;

type PaymongoResource = {
  id: string;
  attributes: JsonRecord;
};

export type PaymongoCheckoutResult = {
  checkoutSessionId: string;
  checkoutUrl: string;
  livemode: false;
};

export type StorefrontPaymentStatusResult = {
  orderNumber: string;
  paymentMethod: CustomerPaymentMethod;
  paymentStatus: CustomerPaymentStatus;
  totalAmount: string;
  itemCount: number;
  paidAt: Date | null;
  canResumePayment: boolean;
};

function requireTestSecretKey() {
  const secretKey = env.PAYMONGO_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new HttpError(503, "PayMongo test checkout is not configured.", {
      code: "PAYMONGO_NOT_CONFIGURED",
      expose: true
    });
  }

  if (!secretKey.startsWith("sk_test_")) {
    throw new HttpError(503, "This YsabelleStore build accepts PayMongo test keys only.", {
      code: "PAYMONGO_TEST_KEY_REQUIRED",
      expose: true
    });
  }

  return secretKey;
}

async function paymongoRequest(path: string, init: RequestInit = {}) {
  const secretKey = requireTestSecretKey();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Basic ${Buffer.from(`${secretKey}:`, "utf8").toString("base64")}`);

  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${PAYMONGO_API_ORIGIN}${path}`, {
      ...init,
      headers
    });
  } catch (error) {
    throw new HttpError(502, "PayMongo could not be reached. Please try again.", {
      code: "PAYMONGO_UNREACHABLE",
      details: error instanceof Error ? { name: error.name } : undefined,
      expose: true
    });
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new HttpError(502, "PayMongo could not process the test checkout request.", {
      code: "PAYMONGO_UPSTREAM_ERROR",
      details: { httpStatus: response.status },
      expose: true
    });
  }

  return payload;
}

function parsePaymongoResource(payload: unknown, expectedType = "checkout_session"): PaymongoResource {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const attributes = asRecord(data?.attributes);
  const id = stringValue(data?.id);
  const type = stringValue(data?.type);

  if (!data || !attributes || !id || (type && type !== expectedType)) {
    throw new HttpError(502, "PayMongo returned an unexpected response.", {
      code: "PAYMONGO_INVALID_RESPONSE",
      expose: true
    });
  }

  return { id, attributes };
}

function storefrontReturnUrl(orderNumber: string, payment: string) {
  const url = new URL("/order-success", env.FRONTEND_URL);
  url.searchParams.set("order", orderNumber);
  url.searchParams.set("payment", payment);
  return url.toString();
}

async function requireOwnedPaymongoOrder(orderNumber: string, customerAccountId: string) {
  const order = await prisma.customerOrder.findFirst({
    include: {
      items: {
        include: {
          product: {
            select: { name: true }
          }
        }
      }
    },
    where: {
      customerAccountId,
      orderNumber
    }
  });

  if (!order) {
    throw new HttpError(404, "Order was not found.", {
      code: "STOREFRONT_ORDER_NOT_FOUND"
    });
  }

  if (order.paymentMethod !== CustomerPaymentMethod.PAYMONGO) {
    throw new HttpError(409, "This order does not use PayMongo.", {
      code: "ORDER_NOT_PAYMONGO"
    });
  }

  return order;
}

export async function createOrReusePaymongoCheckout(
  orderNumber: string,
  customerAccountId: string
): Promise<PaymongoCheckoutResult> {
  const order = await requireOwnedPaymongoOrder(orderNumber, customerAccountId);

  if (order.paymentStatus === CustomerPaymentStatus.PAID) {
    throw new HttpError(409, "This order is already paid.", {
      code: "ORDER_ALREADY_PAID"
    });
  }

  if (order.paymongoCheckoutSessionId && order.paymongoCheckoutUrl) {
    return {
      checkoutSessionId: order.paymongoCheckoutSessionId,
      checkoutUrl: order.paymongoCheckoutUrl,
      livemode: false
    };
  }

  const response = await paymongoRequest(PAYMONGO_CREATE_CHECKOUT_PATH, {
    method: "POST",
    headers: {
      "Idempotency-Key": `ysabelle-order-${order.id}`
    },
    body: JSON.stringify({
      data: {
        attributes: {
          billing: {
            name: order.customerName,
            ...(order.customerEmail ? { email: order.customerEmail } : {})
          },
          line_items: order.items.map((item) => ({
            name: item.product.name,
            amount: paymongoCentavos(item.unitPrice),
            currency: PAYMONGO_CURRENCY,
            quantity: item.quantity
          })),
          payment_method_types: ["card"],
          success_url: storefrontReturnUrl(order.orderNumber, "paymongo"),
          cancel_url: storefrontReturnUrl(order.orderNumber, "cancelled"),
          reference_number: order.orderNumber,
          description: `Ysabelle Store pickup order ${order.orderNumber}`,
          show_description: true,
          show_line_items: true,
          metadata: {
            order_id: order.id,
            customer_account_id: customerAccountId
          }
        }
      }
    })
  });

  const session = parsePaymongoResource(response);
  const checkoutUrl = stringValue(session.attributes.checkout_url);
  const livemode = session.attributes.livemode;

  if (!checkoutUrl || livemode === true) {
    throw new HttpError(502, "PayMongo did not return a valid test checkout session.", {
      code: "PAYMONGO_INVALID_CHECKOUT_SESSION",
      expose: true
    });
  }

  await prisma.$transaction([
    prisma.customerOrder.update({
      data: {
        paymongoCheckoutSessionId: session.id,
        paymongoCheckoutUrl: checkoutUrl,
        paymentStatus: CustomerPaymentStatus.PENDING
      },
      where: { id: order.id }
    }),
    prisma.customerCartItem.deleteMany({
      where: { customerAccountId }
    })
  ]);

  return {
    checkoutSessionId: session.id,
    checkoutUrl,
    livemode: false
  };
}

export async function getStorefrontPaymentStatus(
  orderNumber: string,
  customerAccountId: string
): Promise<StorefrontPaymentStatusResult> {
  let order = await prisma.customerOrder.findFirst({
    select: {
      id: true,
      orderNumber: true,
      customerAccountId: true,
      paymentMethod: true,
      paymentStatus: true,
      paymongoCheckoutSessionId: true,
      totalAmount: true,
      paidAt: true,
      _count: { select: { items: true } }
    },
    where: { customerAccountId, orderNumber }
  });

  if (!order) {
    throw new HttpError(404, "Order was not found.", {
      code: "STOREFRONT_ORDER_NOT_FOUND"
    });
  }

  if (
    order.paymentMethod === CustomerPaymentMethod.PAYMONGO &&
    order.paymentStatus !== CustomerPaymentStatus.PAID &&
    order.paymongoCheckoutSessionId
  ) {
    try {
      const response = await paymongoRequest(
        `${PAYMONGO_RETRIEVE_CHECKOUT_PATH}/${encodeURIComponent(order.paymongoCheckoutSessionId)}`
      );
      const session = parsePaymongoResource(response);
      await reconcilePaidCheckoutSession(session, order.id, order.orderNumber, order.totalAmount);

      order = await prisma.customerOrder.findUniqueOrThrow({
        select: {
          id: true,
          orderNumber: true,
          customerAccountId: true,
          paymentMethod: true,
          paymentStatus: true,
          paymongoCheckoutSessionId: true,
          totalAmount: true,
          paidAt: true,
          _count: { select: { items: true } }
        },
        where: { id: order.id }
      });
    } catch (error) {
      if (
        !(error instanceof HttpError) ||
        error.statusCode < 500 ||
        error.code === "PAYMONGO_NOT_CONFIGURED" ||
        error.code === "PAYMONGO_TEST_KEY_REQUIRED"
      ) {
        throw error;
      }
    }
  }

  return {
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount.toString(),
    itemCount: order._count.items,
    paidAt: order.paidAt,
    canResumePayment:
      order.paymentMethod === CustomerPaymentMethod.PAYMONGO &&
      order.paymentStatus !== CustomerPaymentStatus.PAID
  };
}

export async function handlePaymongoWebhook(
  rawBody: Buffer,
  payload: unknown,
  signatureHeader: string | undefined
) {
  const webhookSecret = env.PAYMONGO_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    throw new HttpError(503, "PayMongo webhook verification is not configured.", {
      code: "PAYMONGO_WEBHOOK_NOT_CONFIGURED",
      expose: true
    });
  }

  if (
    !signatureHeader ||
    !verifyPaymongoWebhookSignature(rawBody, signatureHeader, webhookSecret, false)
  ) {
    throw new HttpError(400, "PayMongo webhook signature is invalid.", {
      code: "INVALID_PAYMONGO_WEBHOOK_SIGNATURE"
    });
  }

  const event = asRecord(asRecord(payload)?.data);
  const eventType = stringValue(event?.type);

  if (!event || !eventType) {
    throw new HttpError(400, "PayMongo webhook payload is invalid.", {
      code: "INVALID_PAYMONGO_WEBHOOK"
    });
  }

  if (event.livemode === true) {
    throw new HttpError(400, "Live PayMongo webhook events are not accepted in test mode.", {
      code: "PAYMONGO_LIVE_EVENT_REJECTED"
    });
  }

  if (eventType !== "checkout_session.payment.paid") {
    return { handled: false, type: eventType };
  }

  const session = parsePaymongoResource(event.data);
  const order = await prisma.customerOrder.findFirst({
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true
    },
    where: {
      paymongoCheckoutSessionId: session.id,
      paymentMethod: CustomerPaymentMethod.PAYMONGO
    }
  });

  if (!order) {
    return { handled: false, type: eventType };
  }

  const paid = await reconcilePaidCheckoutSession(
    session,
    order.id,
    order.orderNumber,
    order.totalAmount
  );

  return { handled: paid, type: eventType };
}

async function reconcilePaidCheckoutSession(
  session: PaymongoResource,
  orderId: string,
  orderNumber: string,
  totalAmount: Prisma.Decimal
) {
  const referenceNumber = stringValue(session.attributes.reference_number);

  if (referenceNumber && referenceNumber !== orderNumber) {
    throw new HttpError(409, "PayMongo order reference did not match.", {
      code: "PAYMONGO_REFERENCE_MISMATCH"
    });
  }

  const payments = Array.isArray(session.attributes.payments)
    ? session.attributes.payments
        .map((payment) => asRecord(payment))
        .filter((payment): payment is JsonRecord => payment !== null)
    : [];

  const paidPayment = payments.find((payment) => {
    const attributes = asRecord(payment.attributes);
    return (
      attributes?.status === "paid" &&
      String(attributes.currency ?? "").toUpperCase() === PAYMONGO_CURRENCY
    );
  });

  if (!paidPayment) {
    return false;
  }

  const paymentAttributes = asRecord(paidPayment.attributes);
  const paymentAmount = numberValue(paymentAttributes?.amount);
  const expectedAmount = paymongoCentavos(totalAmount);

  if (paymentAmount !== expectedAmount) {
    throw new HttpError(409, "PayMongo payment amount did not match the order total.", {
      code: "PAYMONGO_AMOUNT_MISMATCH"
    });
  }

  const paymentId = stringValue(paidPayment.id);
  const paymentIntent = asRecord(session.attributes.payment_intent);
  const paymentIntentId = stringValue(paymentIntent?.id);
  const paidAtSeconds = numberValue(paymentAttributes?.paid_at);

  if (!paymentId) {
    throw new HttpError(502, "PayMongo paid payment identifier was missing.", {
      code: "PAYMONGO_INVALID_PAYMENT",
      expose: true
    });
  }

  await prisma.customerOrder.update({
    data: {
      paymentStatus: CustomerPaymentStatus.PAID,
      paymongoPaymentId: paymentId,
      paymongoPaymentIntentId: paymentIntentId ?? undefined,
      paidAt: paidAtSeconds ? new Date(paidAtSeconds * 1000) : new Date()
    },
    where: { id: orderId }
  });

  return true;
}

export function paymongoCentavos(value: Prisma.Decimal | string | number) {
  const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  const centavos = decimal.mul(100);

  if (!centavos.isInteger() || centavos.isNegative()) {
    throw new Error("PayMongo amount must be a non-negative value with at most two decimal places.");
  }

  return centavos.toNumber();
}

export function verifyPaymongoWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  webhookSecret: string,
  livemode: boolean
) {
  const parts = new Map(
    signatureHeader
      .split(",")
      .map((part) => part.trim().split("=", 2))
      .filter((part): part is [string, string] => part.length === 2 && Boolean(part[0] && part[1]))
  );
  const timestamp = parts.get("t");
  const signature = parts.get(livemode ? "li" : "te");

  if (!timestamp || !signature || !/^[a-f0-9]+$/i.test(signature)) {
    return false;
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
