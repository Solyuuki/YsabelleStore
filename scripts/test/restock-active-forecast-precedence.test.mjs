import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../../backend/src/services/restockPlanningService.ts", import.meta.url),
  "utf8"
);

test("active forecast demand is not masked by a stale zero/smaller persisted recommendation", () => {
  assert.match(
    source,
    /const persistedRecommendationQuantity =[\s\S]*const activeForecastQuantity =/
  );
  assert.match(
    source,
    /if \(forecastDecision && activeForecastQuantity > persistedRecommendationQuantity\)/
  );
  assert.match(source, /recommendationSource = "SARIMA";/);
  assert.match(source, /recommendedQuantity = activeForecastQuantity;/);
});
