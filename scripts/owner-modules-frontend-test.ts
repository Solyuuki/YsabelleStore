import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_WORKSTATION_PREFERENCES,
  normalizeWorkstationPreferences
} from "../frontend/src/services/workstationPreferences.ts";

assert.deepEqual(normalizeWorkstationPreferences(null), DEFAULT_WORKSTATION_PREFERENCES);
assert.deepEqual(
  normalizeWorkstationPreferences({
    dashboardRefreshSeconds: 60,
    refreshDashboardOnFocus: false,
    showForecastSummary: false
  }),
  {
    dashboardRefreshSeconds: 60,
    refreshDashboardOnFocus: false,
    showForecastSummary: false
  }
);
assert.equal(
  normalizeWorkstationPreferences({ dashboardRefreshSeconds: 15 }).dashboardRefreshSeconds,
  30
);

const appShellSource = readFileSync(resolve(process.cwd(), "src/app/AppShell.tsx"), "utf8");
const reportsSource = readFileSync(resolve(process.cwd(), "src/pages/ReportsPage.tsx"), "utf8");
const settingsSource = readFileSync(resolve(process.cwd(), "src/pages/SettingsPage.tsx"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "src/pages/DashboardPage.tsx"), "utf8");

assert.match(appShellSource, /case "\/reports":[\s\S]*?<ReportsPage \/>/);
assert.match(appShellSource, /case "\/settings":[\s\S]*?<SettingsPage \/>/);
assert.doesNotMatch(appShellSource, /ProtectedPage/);

assert.match(reportsSource, /fetchDashboardSummary\(\)/);
assert.match(reportsSource, /listRecentSales\(50\)/);
assert.match(reportsSource, /Today's sales/);
assert.match(reportsSource, /Inventory health/);

assert.match(settingsSource, /saveWorkstationPreferences/);
assert.match(settingsSource, /resetWorkstationPreferences/);
assert.match(settingsSource, /fetchBackendReadiness/);
assert.match(settingsSource, /Local to this device/);

assert.match(dashboardSource, /getWorkstationPreferences/);
assert.match(dashboardSource, /preferences\.dashboardRefreshSeconds/);
assert.match(dashboardSource, /preferences\.refreshDashboardOnFocus/);
assert.match(dashboardSource, /preferences\.showForecastSummary/);

console.log("Owner Reports and Settings frontend contract passed.");
