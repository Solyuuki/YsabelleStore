import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const output = path.resolve("testing/thesis-validation/evidence/automated", timestamp);

const tests = [
  {
    id: "AUTO-01",
    area: "Repository guardrails",
    command: "npm",
    args: ["run", "test:guardrails"]
  },
  {
    id: "AUTO-02",
    area: "Frontend contract tests",
    command: "npm",
    args: ["test", "--workspace", "frontend"]
  },
  {
    id: "AUTO-03",
    area: "Backend behavior and integration tests",
    command: "npm",
    args: ["test", "--workspace", "backend"]
  },
  {
    id: "AUTO-04",
    area: "Forecasting Python tests",
    command: "npm",
    args: ["run", "forecast:test"]
  },
  {
    id: "AUTO-05",
    area: "Barcode identity/import/receiving regression",
    command: "npm",
    args: ["run", "test:barcode-release"]
  }
];

function gitSha() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

fs.mkdirSync(output, { recursive: true });

const results = [];
for (const test of tests) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const result = spawnSync(test.command, test.args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32"
  });
  const durationMs = Math.round(performance.now() - started);
  const status = result.status === 0 ? "PASS" : "FAIL";
  const commandText = [test.command, ...test.args].join(" ");
  const log = [
    `Test ID: ${test.id}`,
    `Area: ${test.area}`,
    `Command: ${commandText}`,
    `Started: ${startedAt}`,
    `Duration ms: ${durationMs}`,
    `Exit code: ${result.status ?? "null"}`,
    `Status: ${status}`,
    "",
    "STDOUT",
    "======",
    result.stdout ?? "",
    "",
    "STDERR",
    "======",
    result.stderr ?? ""
  ].join("\n");

  fs.writeFileSync(path.join(output, `${test.id}.log`), log, "utf8");
  results.push({
    id: test.id,
    area: test.area,
    command: commandText,
    durationMs,
    exitCode: result.status,
    status
  });
}

const summary = {
  generatedAt: new Date().toISOString(),
  gitCommit: gitSha(),
  passed: results.filter((item) => item.status === "PASS").length,
  failed: results.filter((item) => item.status === "FAIL").length,
  total: results.length,
  results
};

fs.writeFileSync(path.join(output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

const markdown = [
  "# Thesis Automated QA Run",
  "",
  `- Commit: ${summary.gitCommit ?? "unavailable"}`,
  `- Generated: ${summary.generatedAt}`,
  `- Passed: ${summary.passed}`,
  `- Failed: ${summary.failed}`,
  "",
  "| Test ID | Area | Command | Status |",
  "| --- | --- | --- | --- |",
  ...results.map(
    (item) => `| ${item.id} | ${item.area} | \`${item.command}\` | **${item.status}** |`
  ),
  "",
  "Individual terminal logs are stored beside this summary."
].join("\n");

fs.writeFileSync(path.join(output, "summary.md"), `${markdown}\n`, "utf8");
console.log(markdown);
console.log(`\nEvidence: ${output}`);

if (summary.failed > 0) {
  process.exitCode = 1;
}
