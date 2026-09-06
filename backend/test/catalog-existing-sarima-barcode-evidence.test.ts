import assert from "node:assert/strict";
import test from "node:test";

import {
  EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITIES,
  buildExistingSarimaBarcodeEvidence,
  isValidGtin
} from "../src/modules/catalog/catalog-existing-sarima-barcode-evidence.js";

test("barcode evidence cohort contains the 19 identity-clear SARIMA products and excludes P144", () => {
  assert.equal(EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITIES.length, 19);
  const codes = EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITIES.map(
    (row: { sarimaSourceProductId: string }) => row.sarimaSourceProductId
  ).sort();
  assert.equal(codes.includes("P144"), false);
  assert.deepEqual(codes, [
    "P022",
    "P038",
    "P054",
    "P065",
    "P078",
    "P080",
    "P088",
    "P091",
    "P098",
    "P102",
    "P217",
    "P218",
    "P237",
    "P241",
    "P261",
    "P370",
    "P385",
    "P425",
    "P443"
  ]);
});

test("GTIN checksum accepts valid UPC-A/EAN-13 and rejects malformed candidates", () => {
  assert.equal(isValidGtin("748485900094"), true);
  assert.equal(isValidGtin("4801981116072"), true);
  assert.equal(isValidGtin("4801981116073"), false);
  assert.equal(isValidGtin("not-a-barcode"), false);
  assert.equal(isValidGtin("123"), false);
});

test("one authoritative exact-retail-unit source can verify a checksum-valid barcode", () => {
  const result = buildExistingSarimaBarcodeEvidence({
    products: [
      {
        id: "p1",
        sku: "SARIMA-P001",
        sarimaSourceProductId: "P001",
        name: "Exact Product",
        barcode: null,
        recordSource: "IMPORT",
        status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      }
    ],
    evidence: [
      {
        productId: "p1",
        sku: "SARIMA-P001",
        sarimaSourceProductId: "P001",
        candidateBarcode: "8997035600027",
        sources: [
          {
            sourceType: "AUTHORIZED_DISTRIBUTOR",
            sourceName: "Distributor",
            url: "https://example.com/distributor",
            observedBarcode: "8997035600027",
            exactProductIdentity: true,
            exactRetailUnit: true,
            independentSourceKey: "distributor.example"
          }
        ]
      }
    ]
  });

  assert.equal(result.rows[0]?.status, "VERIFIED_EXTERNAL");
  assert.equal(result.rows[0]?.verifiedBarcode, "8997035600027");
});

test("two independent retailer sources agreeing on exact product and retail unit can verify a barcode", () => {
  const result = buildExistingSarimaBarcodeEvidence({
    products: [
      {
        id: "p1",
        sku: "SARIMA-P001",
        sarimaSourceProductId: "P001",
        name: "Exact Product",
        barcode: null,
        recordSource: "IMPORT",
        status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      }
    ],
    evidence: [
      {
        productId: "p1",
        sku: "SARIMA-P001",
        sarimaSourceProductId: "P001",
        candidateBarcode: "4801981107971",
        sources: [
          {
            sourceType: "RETAILER",
            sourceName: "Retailer A",
            url: "https://a.example/item",
            observedBarcode: "4801981107971",
            exactProductIdentity: true,
            exactRetailUnit: true,
            independentSourceKey: "a.example"
          },
          {
            sourceType: "RETAILER",
            sourceName: "Retailer B",
            url: "https://b.example/item",
            observedBarcode: "4801981107971",
            exactProductIdentity: true,
            exactRetailUnit: true,
            independentSourceKey: "b.example"
          }
        ]
      }
    ]
  });

  assert.equal(result.rows[0]?.status, "VERIFIED_EXTERNAL");
  assert.equal(result.rows[0]?.verifiedBarcode, "4801981107971");
});

test("single-retailer, marketplace-only, or package-unit ambiguity never auto-verifies a barcode", () => {
  const products = [
    {
      id: "single",
      sku: "SARIMA-P001",
      sarimaSourceProductId: "P001",
      name: "Single retailer",
      barcode: null,
      recordSource: "IMPORT",
      status: "INACTIVE",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false
    },
    {
      id: "market",
      sku: "SARIMA-P002",
      sarimaSourceProductId: "P002",
      name: "Marketplace only",
      barcode: null,
      recordSource: "IMPORT",
      status: "INACTIVE",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false
    },
    {
      id: "pack",
      sku: "SARIMA-P003",
      sarimaSourceProductId: "P003",
      name: "Single sachet",
      barcode: null,
      recordSource: "IMPORT",
      status: "INACTIVE",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false
    }
  ];

  const result = buildExistingSarimaBarcodeEvidence({
    products,
    evidence: [
      {
        productId: "single",
        sku: "SARIMA-P001",
        sarimaSourceProductId: "P001",
        candidateBarcode: "4808887970531",
        sources: [
          {
            sourceType: "RETAILER",
            sourceName: "Only retailer",
            url: "https://one.example/item",
            observedBarcode: "4808887970531",
            exactProductIdentity: true,
            exactRetailUnit: true,
            independentSourceKey: "one.example"
          }
        ]
      },
      {
        productId: "market",
        sku: "SARIMA-P002",
        sarimaSourceProductId: "P002",
        candidateBarcode: "4800022400279",
        sources: [
          {
            sourceType: "MARKETPLACE",
            sourceName: "Marketplace",
            url: "https://market.example/item",
            observedBarcode: "4800022400279",
            exactProductIdentity: true,
            exactRetailUnit: true,
            independentSourceKey: "market.example"
          }
        ]
      },
      {
        productId: "pack",
        sku: "SARIMA-P003",
        sarimaSourceProductId: "P003",
        candidateBarcode: "4800888282965",
        sources: [
          {
            sourceType: "RETAILER",
            sourceName: "Retailer strip listing",
            url: "https://pack.example/item",
            observedBarcode: "4800888282965",
            exactProductIdentity: true,
            exactRetailUnit: false,
            independentSourceKey: "pack.example"
          }
        ]
      }
    ]
  });

  assert.deepEqual(
    result.rows.map((row: { status: string }) => row.status),
    ["NEEDS_PHYSICAL_SCAN", "NEEDS_PHYSICAL_SCAN", "NEEDS_PHYSICAL_SCAN"]
  );
  assert.equal(
    result.rows.every((row: { verifiedBarcode: string | null }) => row.verifiedBarcode === null),
    true
  );
});

test("explicit identity or size conflict stays conflicting and cannot expose a verified barcode", () => {
  const result = buildExistingSarimaBarcodeEvidence({
    products: [
      {
        id: "p1",
        sku: "SARIMA-P001",
        sarimaSourceProductId: "P001",
        name: "Historical 72mL Product",
        barcode: null,
        recordSource: "IMPORT",
        status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      }
    ],
    evidence: [
      {
        productId: "p1",
        sku: "SARIMA-P001",
        sarimaSourceProductId: "P001",
        candidateBarcode: null,
        conflictReason:
          "Current manufacturer evidence is 80mL while the historical identity is 72mL.",
        sources: [
          {
            sourceType: "MANUFACTURER",
            sourceName: "Manufacturer",
            url: "https://maker.example/current",
            observedBarcode: null,
            exactProductIdentity: false,
            exactRetailUnit: false,
            independentSourceKey: "maker.example"
          }
        ]
      }
    ]
  });

  assert.equal(result.rows[0]?.status, "CONFLICTING_EVIDENCE");
  assert.equal(result.rows[0]?.verifiedBarcode, null);
});

test("no candidate and no usable external source is NOT_FOUND", () => {
  const result = buildExistingSarimaBarcodeEvidence({
    products: [
      {
        id: "p1",
        sku: "SARIMA-P001",
        sarimaSourceProductId: "P001",
        name: "Unknown Product",
        barcode: null,
        recordSource: "IMPORT",
        status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      }
    ],
    evidence: [
      {
        productId: "p1",
        sku: "SARIMA-P001",
        sarimaSourceProductId: "P001",
        candidateBarcode: null,
        sources: []
      }
    ]
  });

  assert.equal(result.rows[0]?.status, "NOT_FOUND");
});

test("builder fails closed if a product is no longer in the demoted rehabilitation state", () => {
  assert.throws(
    () =>
      buildExistingSarimaBarcodeEvidence({
        products: [
          {
            id: "p1",
            sku: "SARIMA-P001",
            sarimaSourceProductId: "P001",
            name: "Changed Product",
            barcode: null,
            recordSource: "IMPORT",
            status: "ACTIVE",
            dataQualityStatus: "NEEDS_REVIEW",
            isStorefrontVisible: false
          }
        ],
        evidence: [
          {
            productId: "p1",
            sku: "SARIMA-P001",
            sarimaSourceProductId: "P001",
            candidateBarcode: null,
            sources: []
          }
        ]
      }),
    /EXISTING_SARIMA_BARCODE_EVIDENCE_STATE_MISMATCH/
  );
});
