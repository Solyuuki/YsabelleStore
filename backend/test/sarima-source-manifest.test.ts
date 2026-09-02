import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildSarimaSourceManifest,
  normalizeSarimaSourceName,
  type SarimaManifestInput
} from "../src/modules/catalog/sarima-source-manifest.js";
import { extractSarimaSourceManifest } from "../src/scripts/extractSarimaSourceManifest.js";

function productCode(index: number) {
  return `P${String(index).padStart(3, "0")}`;
}

function validInput(): SarimaManifestInput {
  return {
    products: Array.from({ length: 472 }, (_, index) => ({
      category: index % 2 === 0 ? "Beverages" : "Snacks",
      productId: productCode(index + 1),
      productName: `Product ${index + 1} 100g`
    })),
    validation: {
      errors: [],
      warnings: []
    },
    workbookProductCounts: {
      products2024: 472,
      products2025: 472
    }
  };
}

test("normalizes presentation differences without removing variant or size identity", () => {
  assert.equal(normalizeSarimaSourceName("  Brand — Choco 100G  "), "brand choco 100g");
  assert.notEqual(
    normalizeSarimaSourceName("Brand Choco 100g"),
    normalizeSarimaSourceName("Brand Choco 200g")
  );
  assert.notEqual(
    normalizeSarimaSourceName("Brand Choco"),
    normalizeSarimaSourceName("Brand Vanilla")
  );
});

test("builds exactly P001 through P472 in deterministic order", () => {
  const manifest = buildSarimaSourceManifest(validInput());

  assert.equal(manifest.length, 472);
  assert.equal(manifest[0]?.productCode, "P001");
  assert.equal(manifest.at(-1)?.productCode, "P472");
  assert.deepEqual(manifest[0]?.yearsPresent, [2024, 2025]);
  assert.equal(manifest[0]?.sourceNameNormalized, "product 1 100g");
});

test("rejects annual workbook counts that are not exactly 472", () => {
  const input = validInput();
  input.workbookProductCounts.products2025 = 471;

  assert.throws(
    () => buildSarimaSourceManifest(input),
    /Expected exactly 472 products in each annual SARIMA workbook/
  );
});

test("rejects missing, duplicate, or out-of-range P-codes", () => {
  const input = validInput();
  input.products[471] = {
    category: "Snacks",
    productId: "P471",
    productName: "Duplicate P471"
  };

  assert.throws(
    () => buildSarimaSourceManifest(input),
    /Expected source codes P001 through P472 exactly once/
  );
});

test("rejects workbook identity conflicts and missing-year warnings", () => {
  for (const code of ["PRODUCT_NAME_CONFLICT", "CATEGORY_CONFLICT", "PRODUCT_MISSING_IN_YEAR"]) {
    const input = validInput();
    input.validation.warnings.push({ code });

    assert.throws(
      () => buildSarimaSourceManifest(input),
      new RegExp(`Cannot build SARIMA source manifest.*${code}`)
    );
  }
});

test("rejects workbook validation errors", () => {
  const input = validInput();
  input.validation.errors.push({ code: "NON_CONTINUOUS_MONTHLY_SERIES" });

  assert.throws(
    () => buildSarimaSourceManifest(input),
    /Cannot build SARIMA source manifest from invalid historical workbooks/
  );
});

test("extracts the committed 2024 and 2025 workbooks into a 472-row JSON manifest", async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "ysabelle-phase9-"));
  const outputPath = path.join(temporaryDirectory, "sarima-source-manifest.json");

  try {
    const manifest = await extractSarimaSourceManifest(outputPath);
    const writtenManifest = JSON.parse(await fs.readFile(outputPath, "utf8"));

    assert.equal(manifest.length, 472);
    assert.equal(manifest[0]?.productCode, "P001");
    assert.equal(manifest.at(-1)?.productCode, "P472");
    assert.deepEqual(writtenManifest, manifest);
  } finally {
    await fs.rm(temporaryDirectory, { force: true, recursive: true });
  }
});
