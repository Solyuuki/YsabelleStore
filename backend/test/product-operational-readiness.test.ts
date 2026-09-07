import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@prisma/client";

import { getProductOperationalReadiness } from "../src/services/productOperationalReadiness.js";

function baseProduct() {
  return {
    barcode: "4800000000000",
    costPrice: new Prisma.Decimal("10.00"),
    dataQualityStatus: "APPROVED" as const,
    recordSource: "CATALOG" as const,
    sellingPrice: new Prisma.Decimal("15.00"),
    category: {
      dataQualityStatus: "APPROVED" as const,
      isActive: true,
      recordSource: "CATALOG" as const
    },
    inventory: { id: "inv-ready" },
    duplicateCandidatesLeft: [],
    duplicateCandidatesRight: []
  };
}

test("operational readiness passes only a complete product", () => {
  const readiness = getProductOperationalReadiness(baseProduct());

  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.blockers, []);
});

test("operational readiness reports missing barcode, cost, review and inventory explicitly", () => {
  const readiness = getProductOperationalReadiness({
    ...baseProduct(),
    barcode: null,
    costPrice: null,
    dataQualityStatus: "NEEDS_REVIEW",
    inventory: null
  });

  assert.equal(readiness.ready, false);
  assert.deepEqual(
    readiness.blockers.map((blocker) => blocker.code),
    [
      "CATALOG_REVIEW_REQUIRED",
      "MISSING_VERIFIED_BARCODE",
      "MISSING_PROCUREMENT_COST",
      "INVENTORY_NOT_LINKED"
    ]
  );
});

test("operational readiness blocks unresolved duplicate and invalid category state", () => {
  const readiness = getProductOperationalReadiness({
    ...baseProduct(),
    category: {
      dataQualityStatus: "NEEDS_REVIEW",
      isActive: false,
      recordSource: "CATALOG"
    },
    duplicateCandidatesLeft: [{ status: "PENDING" }]
  });

  assert.equal(readiness.ready, false);
  assert.deepEqual(
    readiness.blockers.map((blocker) => blocker.code),
    ["UNRESOLVED_DUPLICATE", "CATEGORY_INACTIVE", "CATEGORY_REVIEW_REQUIRED"]
  );
});
