import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogImageEngineResult } from "../src/modules/catalog-image/catalogImageEngineRunner.js";
import { describePackageImageQualityFailure } from "../src/services/productPackageImageDiagnostics.js";

function result(diagnostics: CatalogImageEngineResult["diagnostics"]): CatalogImageEngineResult {
  return {
    status: "REJECTED",
    source: { width: 225, height: 225, mode: "RGB" },
    diagnostics,
    metrics: {
      luminance: 140,
      contrastStdDev: 38,
      sharpnessRms: 7,
      foregroundOccupancy: 0.31,
      touchesSafeMargin: false
    },
    variants: {
      processed: { fileName: "processed.webp", width: 243, height: 243 },
      card: { fileName: "card.webp", width: 303, height: 303 },
      pdp: { fileName: "pdp.webp", width: 303, height: 303 }
    }
  };
}

test("import preview explains review-only image failure without approving it", () => {
  const diagnostics: CatalogImageEngineResult["diagnostics"] = [
    {
      code: "PDP_RESOLUTION_LOW",
      message: "Source is below product-detail threshold.",
      severity: "warning"
    }
  ];
  const description = describePackageImageQualityFailure(result(diagnostics));
  assert.match(description, /requires review/);
  assert.match(description, /225×225/);
  assert.match(description, /243×243/);
  assert.match(description, /PDP_RESOLUTION_LOW/);
});

test("import preview retains hard rejection details", () => {
  const diagnostics: CatalogImageEngineResult["diagnostics"] = [
    { code: "DECODE_FAILED", message: "Image could not be decoded.", severity: "error" }
  ];
  const description = describePackageImageQualityFailure(result(diagnostics));
  assert.match(description, /failed automatic catalog quality approval/);
  assert.match(description, /DECODE_FAILED/);
});
