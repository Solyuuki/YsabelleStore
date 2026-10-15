import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const view = readFileSync("frontend/src/components/reports/restockForecastViewModel.ts", "utf8");
const panel = readFileSync("frontend/src/components/reports/RestockForecastPanel.tsx", "utf8");
const footer = readFileSync("frontend/src/components/customer/CustomerFooter.tsx", "utf8");
const shell = readFileSync("frontend/src/app/AppShell.tsx", "utf8");
const version = readFileSync("frontend/src/config/appVersion.ts", "utf8");

test("coverage preserves historical, forecast and unavailable provenance", () => {
  assert.match(view, /basis: "HISTORICAL"/);
  assert.match(view, /basis: "FORECAST"/);
  assert.match(view, /basis: "UNAVAILABLE"/);
  assert.match(view, /usableStock\(candidate\) \/ forecastDemand/);
  assert.match(view, /forecastDemand > 0/);
  assert.match(view, /metricLabel: "Forecast cover"/);
  assert.match(view, /label: "Not available"/);
  assert.match(view, /return "History limited"/);
});

test("stockout card never interpolates historical coverage placeholder as forecast cover", () => {
  assert.doesNotMatch(panel, /Current usable stock covers about/);
  assert.match(panel, /stockAlertExplanation\(selected\)/);
  assert.match(panel, /selectedCoverage\.metricLabel/);
  assert.match(panel, /selectedCoverage\.detail/);
  assert.match(view, /coverage\.basis === "FORECAST"/);
});

test("storefront hides internal login advertisement without removing internal route", () => {
  assert.doesNotMatch(footer, /Staff\s*\/\s*Owner Login/);
  assert.doesNotMatch(footer, /href="\/staff-login"/);
  assert.match(shell, /internalRoutePaths[\s\S]*?["']\/staff-login["']/);
});

test("visible app version advances independently of npm workspace metadata", () => {
  assert.match(version, /APP_VERSION = "0\.12\.0"/);
  assert.match(version, /APP_VERSION_LABEL = `v\$\{APP_VERSION\}`/);
});
