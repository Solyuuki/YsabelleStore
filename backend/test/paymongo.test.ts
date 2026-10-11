import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { Prisma } from "@prisma/client";

import {
  paymongoCentavos,
  getPaymongoTestCheckoutPaymentMethods,
  parsePaymongoWebhookEvent,
  verifyPaymongoWebhookSignature
} from "../src/services/paymongoService.js";

test("PayMongo amount conversion uses exact centavos", () => {
  assert.equal(paymongoCentavos(new Prisma.Decimal("199.99")), 19999);
  assert.equal(paymongoCentavos("0.50"), 50);
  assert.throws(() => paymongoCentavos("1.001"));
});

test("PayMongo test webhook signature validates the raw body", () => {
  const rawBody = Buffer.from('{"data":{"type":"checkout_session.payment.paid"}}', "utf8");
  const timestamp = "1767225600";
  const secret = "whsec_test_ysabelle";
  const digest = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");

  assert.equal(
    verifyPaymongoWebhookSignature(rawBody, `t=${timestamp},te=${digest}`, secret, false),
    true
  );
  assert.equal(
    verifyPaymongoWebhookSignature(rawBody, `t=${timestamp},li=${digest}`, secret, false),
    false
  );
  assert.equal(
    verifyPaymongoWebhookSignature(
      Buffer.from('{"data":{"type":"tampered"}}', "utf8"),
      `t=${timestamp},te=${digest}`,
      secret,
      false
    ),
    false
  );
});

test("PayMongo webhook parser accepts hosted-checkout and standard event envelopes", () => {
  const checkoutSession = {
    id: "cs_test_ysabelle",
    type: "checkout_session",
    attributes: { livemode: false }
  };

  assert.deepEqual(
    parsePaymongoWebhookEvent({
      event_type: "send.webhook",
      data: {
        type: "checkout_session.payment.paid",
        resource: "checkout_session",
        livemode: false,
        data: checkoutSession
      }
    }),
    {
      type: "checkout_session.payment.paid",
      livemode: false,
      data: checkoutSession
    }
  );

  assert.deepEqual(
    parsePaymongoWebhookEvent({
      data: {
        id: "evt_test_ysabelle",
        type: "event",
        attributes: {
          type: "checkout_session.payment.paid",
          livemode: false,
          data: checkoutSession
        }
      }
    }),
    {
      type: "checkout_session.payment.paid",
      livemode: false,
      data: checkoutSession
    }
  );

  assert.equal(parsePaymongoWebhookEvent({ data: { type: "event", attributes: {} } }), null);
});

test("PayMongo test checkout keeps card and supported sandbox alternatives", () => {
  assert.deepEqual(getPaymongoTestCheckoutPaymentMethods(), [
    "card",
    "gcash",
    "paymaya",
    "grab_pay",
    "qrph"
  ]);
});
