import assert from "node:assert/strict";
import test from "node:test";

import {
  CustomerDeliveryStatus,
  CustomerPaymentMethod,
  CustomerPaymentStatus
} from "@prisma/client";

import {
  canTransitionDeliveryStatus,
  deliveryStatusLabel,
  deliveryViewWhere,
  isCodSettlementReady,
  isPaymongoPaymentPending,
  normalizeRiderPhone
} from "../src/services/deliveryService.js";

test("delivery status workflow permits only controlled forward transitions", () => {
  assert.equal(
    canTransitionDeliveryStatus(
      CustomerDeliveryStatus.ORDER_PLACED,
      CustomerDeliveryStatus.PREPARING
    ),
    true
  );
  assert.equal(
    canTransitionDeliveryStatus(
      CustomerDeliveryStatus.READY_FOR_DELIVERY,
      CustomerDeliveryStatus.OUT_FOR_DELIVERY
    ),
    true
  );
  assert.equal(
    canTransitionDeliveryStatus(
      CustomerDeliveryStatus.OUT_FOR_DELIVERY,
      CustomerDeliveryStatus.DELIVERED
    ),
    false
  );
  assert.equal(
    canTransitionDeliveryStatus(
      CustomerDeliveryStatus.DELIVERY_FAILED,
      CustomerDeliveryStatus.READY_FOR_DELIVERY
    ),
    true
  );
});

test("customer delivery labels use clear storefront wording", () => {
  assert.equal(deliveryStatusLabel(CustomerDeliveryStatus.ORDER_PLACED), "Order placed");
  assert.equal(deliveryStatusLabel(CustomerDeliveryStatus.OUT_FOR_DELIVERY), "On the way");
  assert.equal(deliveryStatusLabel(CustomerDeliveryStatus.DELIVERED), "Delivered");
});

test("COD settlement requires confirmed physical delivery", () => {
  assert.equal(
    isCodSettlementReady({
      customerConfirmedAt: new Date(),
      deliveryStatus: CustomerDeliveryStatus.DELIVERED,
      paymentMethod: CustomerPaymentMethod.CASH_ON_DELIVERY
    }),
    true
  );
  assert.equal(
    isCodSettlementReady({
      customerConfirmedAt: null,
      deliveryStatus: CustomerDeliveryStatus.DELIVERED,
      paymentMethod: CustomerPaymentMethod.CASH_ON_DELIVERY
    }),
    false
  );
  assert.equal(
    isCodSettlementReady({
      customerConfirmedAt: new Date(),
      deliveryStatus: CustomerDeliveryStatus.DELIVERED,
      paymentMethod: CustomerPaymentMethod.PAYMONGO
    }),
    false
  );
});

test("PayMongo delivery processing stays locked until payment is confirmed", () => {
  assert.equal(
    isPaymongoPaymentPending({
      paymentMethod: CustomerPaymentMethod.PAYMONGO,
      paymentStatus: CustomerPaymentStatus.PENDING
    }),
    true
  );
  assert.equal(
    isPaymongoPaymentPending({
      paymentMethod: CustomerPaymentMethod.PAYMONGO,
      paymentStatus: CustomerPaymentStatus.PAID
    }),
    false
  );
  assert.equal(
    isPaymongoPaymentPending({
      paymentMethod: CustomerPaymentMethod.CASH_ON_DELIVERY,
      paymentStatus: CustomerPaymentStatus.PENDING
    }),
    false
  );
});

test("delivery history retains completed or cancelled orders and unpaid COD remains actionable", () => {
  assert.deepEqual(deliveryViewWhere("all"), {});
  const historical = deliveryViewWhere("history");
  assert.deepEqual(historical, {
    OR: [
      { deliveryStatus: CustomerDeliveryStatus.CANCELLED },
      { deliveryStatus: CustomerDeliveryStatus.DELIVERED }
    ]
  });
  assert.deepEqual(deliveryViewWhere("active"), {
    OR: [
      { NOT: historical },
      {
        deliveryStatus: CustomerDeliveryStatus.DELIVERED,
        paymentStatus: { not: CustomerPaymentStatus.PAID }
      }
    ]
  });
});

test("rider phone normalizes common Philippine formats and rejects invalid IDs", () => {
  assert.equal(normalizeRiderPhone("0976 650 0867"), "09766500867");
  assert.equal(normalizeRiderPhone("+63 976 650 0867"), "+639766500867");
  assert.equal(normalizeRiderPhone("BOOKING-1234"), null);
  assert.equal(normalizeRiderPhone(""), null);
});
