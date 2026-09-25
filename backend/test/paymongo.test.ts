import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { Prisma } from "@prisma/client";

import {
  paymongoCentavos,
  selectPaymongoCheckoutPaymentMethods,
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

test("PayMongo checkout keeps only supported enabled methods in customer-friendly order", () => {
  assert.deepEqual(
    selectPaymongoCheckoutPaymentMethods([
      "card",
      "qrph",
      "gcash",
      "paymaya",
      "grab_pay",
      "shopee_pay",
      "unsupported_method"
    ]),
    ["gcash", "paymaya", "grab_pay", "shopee_pay", "qrph", "card"]
  );
});
