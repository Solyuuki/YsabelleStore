import assert from "node:assert/strict";
import test from "node:test";

import { parseCatalogImageEngineOutput } from "../src/modules/catalog-image/catalogImageEngineRunner.js";

const validResult = {
  diagnostics: [],
  metrics: {
    contrastStdDev: 40,
    foregroundOccupancy: 0.5,
    luminance: 120,
    sharpnessRms: 20,
    touchesSafeMargin: false
  },
  orientedSource: { height: 900, width: 900 },
  source: { height: 900, mode: "RGBA", width: 900 },
  status: "APPROVED",
  upscaleFactor: { card: 0.5, pdp: 1.1 },
  variants: {
    card: { fileName: "card.webp", height: 480, width: 480 },
    pdp: { fileName: "pdp.webp", height: 1000, width: 1000 },
    processed: { fileName: "processed.webp", height: 900, width: 900 }
  }
};

test("catalog image runner accepts a valid CIQE result", () => {
  const result = parseCatalogImageEngineOutput(JSON.stringify(validResult));

  assert.equal(result.status, "APPROVED");
  assert.equal(result.source.width, 900);
  assert.equal(result.variants?.card.fileName, "card.webp");
});

test("catalog image runner accepts rejected decode results without variants", () => {
  const result = parseCatalogImageEngineOutput(
    JSON.stringify({
      diagnostics: [
        { code: "DECODE_FAILED", message: "Image could not be decoded safely.", severity: "error" }
      ],
      metrics: {
        contrastStdDev: null,
        foregroundOccupancy: null,
        luminance: null,
        sharpnessRms: null,
        touchesSafeMargin: null
      },
      source: { height: null, mode: null, width: null },
      status: "REJECTED"
    })
  );

  assert.equal(result.status, "REJECTED");
  assert.equal(result.variants, undefined);
});

test("catalog image runner rejects malformed or incomplete Python output", () => {
  for (const stdout of [
    "not-json",
    JSON.stringify({}),
    JSON.stringify({ ...validResult, status: "MAYBE" }),
    JSON.stringify({ ...validResult, variants: { card: { fileName: "../escape.webp" } } })
  ]) {
    assert.throws(
      () => parseCatalogImageEngineOutput(stdout),
      (error) =>
        error instanceof Error &&
        (error as { code?: string }).code === "CATALOG_IMAGE_INVALID_RESULT"
    );
  }
});
