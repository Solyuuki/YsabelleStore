import fs from "node:fs";

import {
  assertCompleteAuditReport,
  classifyAuditVulnerabilities
} from "./lib/dependency-audit-policy.mjs";
import { runCommand } from "./lib/run-command.mjs";

const productionPolicy = process.argv.includes("--production");
const audit = runCommand("npm", ["audit", "--json"]);

if (!audit.stdout.trim()) {
  console.error(audit.stderr || "npm audit did not return machine-readable output.");
  process.exit(audit.status);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error("npm audit returned output that was not valid JSON.");
  process.exit(1);
}

try {
  assertCompleteAuditReport(report, audit.status);
} catch (error) {
  console.error(error instanceof Error ? error.message : "npm audit report validation failed.");
  process.exit(1);
}

const lockfile = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const classified = classifyAuditVulnerabilities(report, lockfile);

printFindings("Production-reachable", classified.productionReachable);
printFindings("Development-only", classified.developmentOnly);

const blockingFindings = (
  productionPolicy
    ? classified.productionReachable
    : [...classified.productionReachable, ...classified.developmentOnly]
).filter((finding) => ["high", "critical"].includes(finding.severity));

if (classified.developmentOnly.length > 0) {
  console.warn(
    "WARNING: Development-only audit findings remain visible and require review, but do not reach the packaged application dependency graph."
  );
}

if (blockingFindings.length > 0) {
  console.error(
    `FAIL: ${blockingFindings.length} high/critical ${
      productionPolicy ? "production-reachable" : "total"
    } audit finding(s).`
  );
  process.exit(1);
}

console.log(
  `PASS: No high/critical ${productionPolicy ? "production-reachable" : "dependency"} findings.`
);

function printFindings(label, findings) {
  if (findings.length === 0) {
    console.log(`${label}: none`);
    return;
  }

  console.log(`${label}:`);
  for (const finding of findings) {
    console.log(
      `- ${finding.name}: ${finding.severity}; ${finding.direct ? "direct" : "transitive"}`
    );
  }
}
