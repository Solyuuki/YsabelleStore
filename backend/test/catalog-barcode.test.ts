import assert from "node:assert/strict";
import test from "node:test";

import {
  buildYsabelleInternalBarcode,
  isYsabelleInternalBarcode,
  YSABELLE_INTERNAL_BARCODE_PREFIX
} from "../src/utils/catalogBarcode.js";

test("internal barcode generation is deterministic and scanner-safe", () => {
  const first = buildYsabelleInternalBarcode({ id: "prd-1", sku: "SARIMA-P091" });
  const second = buildYsabelleInternalBarcode({ id: "prd-1", sku: "SARIMA-P091" });

  assert.equal(first, `${YSABELLE_INTERNAL_BARCODE_PREFIX}SARIMA-P091`);
  assert.equal(second, first);
  assert.match(first, /^[A-Z0-9-]+$/);
  assert.equal(first.length <= 80, true);
  assert.equal(isYsabelleInternalBarcode(first), true);
});

test("internal barcode collision retries are deterministic and produce a new scanner-safe value", () => {
  const base = buildYsabelleInternalBarcode({ id: "prd-1", sku: "SARIMA-P091" });
  const retry = buildYsabelleInternalBarcode({ id: "prd-1", sku: "SARIMA-P091", attempt: 1 });
  const sameRetry = buildYsabelleInternalBarcode({
    id: "prd-1",
    sku: "SARIMA-P091",
    attempt: 1
  });

  assert.equal(retry, `${YSABELLE_INTERNAL_BARCODE_PREFIX}SARIMA-P091-1`);
  assert.notEqual(retry, base);
  assert.equal(retry, sameRetry);
  assert.equal(retry.length <= 80, true);
  assert.equal(isYsabelleInternalBarcode(retry), true);
});

test("internal barcode generation falls back to a stable digest when sku is unusable", () => {
  const value = buildYsabelleInternalBarcode({
    id: "prd-long",
    sku: "!".repeat(200)
  });

  assert.match(value, /^YSB-[A-F0-9]{24}$/);
  assert.equal(value, buildYsabelleInternalBarcode({ id: "prd-long", sku: "!".repeat(200) }));
});

test("external barcodes are not classified as Ysabelle internal barcodes", () => {
  assert.equal(isYsabelleInternalBarcode("4800049720107"), false);
  assert.equal(isYsabelleInternalBarcode(null), false);
});
