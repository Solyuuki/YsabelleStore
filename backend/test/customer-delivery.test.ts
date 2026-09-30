import assert from "node:assert/strict";
import test from "node:test";

import { CustomerDeliveryStatus, CustomerPaymentMethod } from "@prisma/client";

import {
  canTransitionDeliveryStatus,
  deliveryStatusLabel,
  isCodSettlementReady
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
