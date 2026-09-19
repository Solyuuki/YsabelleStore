import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { CustomerOrderStatus, PaymongoCheckoutStatus, Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { createPaymongoTestCheckout } from "../modules/paymongo/paymongoGateway.js";
import { HttpError } from "../utils/httpError.js";
import type { StorefrontOrderInput } from "../validators/storefront.validators.js";
import { createStorefrontOrder } from "./storefrontService.js";

function toCentavos(value: string) {
  const amount = new Prisma.Decimal(value).mul(100).toNumber();
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new HttpError(422, "The order amount is not supported for online payment.", {
      code: "PAYMONGO_INVALID_AMOUNT"
    });
  }
  return amount;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function frontendBaseUrl() {
  const url = new URL(env.FRONTEND_URL);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new HttpError(503, "A secure customer website URL is required for test checkout.", {
      code: "PAYMONGO_INVALID_FRONTEND_URL"
    });
  }
  return url.origin;
}

export async function startCustomerPaymongoCheckout(
  input: StorefrontOrderInput,
  context: { customerAccountId?: string }
) {
  // Reuse the existing authoritative stock and price validations. The legacy
  // order method stays CASH_ON_PICKUP; this independent ledger is the source
  // of truth for online test-payment method/status until the order enum migrates.
  const order = await createStorefrontOrder({ ...input, paymentMethod: "CASH_ON_PICKUP" }, context);
  const accessToken = randomBytes(32).toString("hex");
  const amountCentavos = toCentavos(order.totalAmount);
  await prisma.customerPaymongoCheckout.create({
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      accessTokenHash: tokenHash(accessToken),
      amountCentavos: BigInt(amountCentavos)
    }
  });
  const base = frontendBaseUrl();
  try {
    const session = await createPaymongoTestCheckout({
      orderNumber: order.orderNumber,
      lineItems: order.items.map((item) => ({
        name: item.productName.slice(0, 120),
        amount: toCentavos(item.unitPrice),
        currency: "PHP" as const,
        quantity: item.quantity
      })),
      billing: {
        name: input.customerName,
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
        phone: input.customerPhone
      },
      successUrl: `${base}/order-success?order=${encodeURIComponent(order.orderNumber)}`,
      cancelUrl: `${base}/cart?payment=cancelled`
    });
    await prisma.customerPaymongoCheckout.update({
      where: { orderId: order.id },
      data: {
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        status: PaymongoCheckoutStatus.AWAITING_PAYMENT
      }
    });
    return {
      order: { ...order, paymentMethod: "PAYMONGO_TEST" as const, paymentStatus: "AWAITING_PAYMENT" as const },
      checkoutUrl: session.checkoutUrl,
      accessToken
    };
  } catch (error) {
    await prisma.customerPaymongoCheckout.updateMany({
      where: { orderId: order.id, status: PaymongoCheckoutStatus.CREATING },
      data: { status: PaymongoCheckoutStatus.FAILED }
    });
    throw error;
  }
}

export async function readCustomerPaymongoStatus(orderId: string, accessToken: string | undefined) {
  const checkout = await prisma.customerPaymongoCheckout.findUnique({ where: { orderId } });
  if (!checkout || !accessToken || !/^[a-f0-9]{64}$/i.test(accessToken)) {
    throw new HttpError(404, "Online payment order not found.", { code: "PAYMONGO_ORDER_NOT_FOUND" });
  }
  const provided = Buffer.from(tokenHash(accessToken), "hex");
  const expected = Buffer.from(checkout.accessTokenHash, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new HttpError(404, "Online payment order not found.", { code: "PAYMONGO_ORDER_NOT_FOUND" });
  }
  const order = await prisma.customerOrder.findUnique({ where: { id: orderId }, select: {
    status: true, totalAmount: true, orderNumber: true
  } });
  if (!order) {
    throw new HttpError(404, "Online payment order not found.", { code: "PAYMONGO_ORDER_NOT_FOUND" });
  }
  return {
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    paymentMethod: "PAYMONGO_TEST" as const,
    paymentStatus: checkout.status,
    totalAmount: order.totalAmount.toString()
  };
}

type PaymongoPaidSession = {
  id?: string;
  attributes?: {
    reference_number?: string;
    payments?: Array<{ id?: string; attributes?: {
      amount?: number; currency?: string; status?: string
    } }>;
  };
};

type PaymongoWebhook = {
  data?: {
    type?: string;
    livemode?: boolean;
    data?: PaymongoPaidSession;
    attributes?: {
      type?: string;
      livemode?: boolean;
      data?: PaymongoPaidSession;
    };
  };
};

/** Must only be called after verifying the test webhook's raw-body HMAC. */
export async function reconcilePaymongoPaidWebhook(payload: PaymongoWebhook) {
  const event = payload.data;
  const eventType = event?.type === "event" ? event.attributes?.type : event?.type;
  const liveMode = event?.type === "event" ? event.attributes?.livemode : event?.livemode;
  if (eventType !== "checkout_session.payment.paid" || liveMode !== false) {
    return;
  }
  const session = event?.type === "event" ? event.attributes?.data : event?.data;
  const sessionId = session?.id;
  const orderNumber = session?.attributes?.reference_number;
  if (!sessionId?.startsWith("cs_") || !orderNumber) {
    throw new HttpError(400, "Invalid PayMongo payment event.", { code: "PAYMONGO_INVALID_EVENT" });
  }
  await prisma.$transaction(async (tx) => {
    const checkout = await tx.customerPaymongoCheckout.findUnique({ where: { sessionId } });
    if (!checkout || checkout.orderNumber !== orderNumber) {
      throw new HttpError(409, "PayMongo checkout session is not ready for reconciliation.", {
        code: "PAYMONGO_SESSION_MISMATCH"
      });
    }
    if (checkout.status === PaymongoCheckoutStatus.PAID) return;
    if (checkout.status !== PaymongoCheckoutStatus.AWAITING_PAYMENT) {
      throw new HttpError(409, "PayMongo checkout is not awaiting payment.", {
        code: "PAYMONGO_NOT_AWAITING_PAYMENT"
      });
    }
    const payment = session?.attributes?.payments?.find((candidate) =>
      candidate.attributes?.status === "paid" &&
      candidate.attributes.currency?.toUpperCase() === "PHP" &&
      Number.isSafeInteger(candidate.attributes.amount) &&
      BigInt(candidate.attributes.amount!) === checkout.amountCentavos &&
      Boolean(candidate.id)
    );
    if (!payment?.id) {
      throw new HttpError(422, "Payment details do not match the stored order amount.", {
        code: "PAYMONGO_PAYMENT_MISMATCH"
      });
    }
    const order = await tx.customerOrder.findUnique({ where: { id: checkout.orderId } });
    if (!order || order.orderNumber !== checkout.orderNumber ||
      toCentavos(order.totalAmount.toString()) !== Number(checkout.amountCentavos) ||
      order.status === CustomerOrderStatus.CANCELLED) {
      throw new HttpError(409, "The matching order is no longer payable.", {
        code: "PAYMONGO_ORDER_NOT_PAYABLE"
      });
    }
    const updated = await tx.customerPaymongoCheckout.updateMany({
      where: { id: checkout.id, status: PaymongoCheckoutStatus.AWAITING_PAYMENT },
      data: { status: PaymongoCheckoutStatus.PAID, paymentId: payment.id, paidAt: new Date() }
    });
    if (updated.count && order.status === CustomerOrderStatus.PENDING) {
      await tx.customerOrder.updateMany({
        where: { id: order.id, status: CustomerOrderStatus.PENDING },
        data: { status: CustomerOrderStatus.CONFIRMED }
      });
    }
  });
}
