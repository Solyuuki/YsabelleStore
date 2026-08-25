import { checkVersionConsistency } from "./lib/version-policy.mjs";

const result = checkVersionConsistency();

console.log(`Private package version: ${result.packageVersion}`);
console.log(`Application display version: ${result.appVersion ?? "invalid"}`);
console.log("Sprint status: independent; controlled by config/guardrails.json.");

if (result.errors.length > 0) {
  for (const error of result.errors) {
    console.error(`FAIL: ${error}`);
  }
  process.exit(1);
}

console.log("PASS: Version sources satisfy the documented separation policy.");
