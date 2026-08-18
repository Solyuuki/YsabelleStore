import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { writeFileAtomic } from "../lib/atomic-write.mjs";
import * as auditPolicy from "../lib/dependency-audit-policy.mjs";
import { withFileTransaction } from "../lib/file-transaction.mjs";
import { loadGuardrailContext } from "../lib/guardrail-config.mjs";
import { table, upsertTableRow } from "../lib/markdown-utils.mjs";
import { createPrepushPlan } from "../lib/prepush-plan.mjs";
import * as validationSummary from "../lib/validation-summary.mjs";
import { checkVersionConsistency } from "../lib/version-policy.mjs";
import { runSteps } from "../lib/workflow-runner.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function temporaryRepository() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ysabelle-guardrail-"));
  fs.mkdirSync(path.join(rootDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, "config", "guardrails.json"),
    `${JSON.stringify({ activeSprint: 4 }, null, 2)}\n`,
    "utf8"
  );
  return rootDir;
}

test("m1 resolves to m1-abarado and the configured active sprint", () => {
  const rootDir = temporaryRepository();
  fs.mkdirSync(path.join(rootDir, "docs", "sprints", "sprint-4"), { recursive: true });

  const context = loadGuardrailContext({
    args: ["--member", "m1"],
    branch: "sprint/v0.4/sprint-4",
    rootDir
  });

  assert.equal(context.member.key, "m1-abarado");
  assert.equal(context.sprint.sprintNumber, 4);
  assert.equal(context.sprint.sprintSlug, "sprint-4");
  assert.equal(context.sprint.sprintDir, "docs/sprints/sprint-4");
});

test("member overrides reject values that only begin with a valid member key", () => {
  const rootDir = temporaryRepository();
  fs.mkdirSync(path.join(rootDir, "docs", "sprints", "sprint-4"), { recursive: true });

  assert.throws(
    () =>
      loadGuardrailContext({
        args: ["--member", "m1-invalid"],
        branch: "sprint/v0.4/sprint-4",
        rootDir
      }),
    /unknown member.*m1-invalid.*--member m1.*--member m2.*--member m3/i
  );
});

test("a branch sprint mismatch fails with an actionable configuration error", () => {
  const rootDir = temporaryRepository();
  fs.mkdirSync(path.join(rootDir, "docs", "sprints", "sprint-4"), { recursive: true });

  assert.throws(
    () =>
      loadGuardrailContext({
        args: ["--member", "m1"],
        branch: "sprint/v0.5/sprint-5",
        rootDir
      }),
    /branch .* declares sprint-5.*activeSprint is 4.*config\/guardrails\.json/i
  );
});

test("a missing active sprint folder fails before metadata can mutate", () => {
  const rootDir = temporaryRepository();
  const artifactPath = path.join(rootDir, "artifact.md");
  fs.writeFileSync(artifactPath, "unchanged\n", "utf8");
  let mutationRan = false;

  assert.throws(() => {
    loadGuardrailContext({
      args: ["--member", "m1"],
      branch: "sprint/v0.4/sprint-4",
      rootDir
    });
    mutationRan = true;
    fs.writeFileSync(artifactPath, "changed\n", "utf8");
  }, /docs\/sprints\/sprint-4.*does not exist.*config\/guardrails\.json/i);
  assert.equal(mutationRan, false);
  assert.equal(fs.readFileSync(artifactPath, "utf8"), "unchanged\n");
});

test("pre-push validates before status mutation and never bumps a version", () => {
  const plan = createPrepushPlan({ memberKey: "m1-abarado" });
  const firstMutation = plan.findIndex((step) => step.mutates);

  assert.ok(firstMutation > 0);
  assert.deepEqual(
    plan.slice(0, firstMutation).map((step) => step.label),
    ["guardrail preflight", "code verification"]
  );
  assert.equal(
    plan.some((step) => /version.?bump/i.test(step.label)),
    false
  );
  assert.equal(
    plan.some((step) => step.args.includes("version:bump")),
    false
  );
});

test("child failure status propagates and later steps do not execute", () => {
  const executed = [];
  const result = runSteps(
    [{ label: "first" }, { label: "fails" }, { label: "must not run" }],
    (step) => {
      executed.push(step.label);
      return step.label === "fails" ? { ok: false, status: 17 } : { ok: true, status: 0 };
    }
  );

  assert.deepEqual(executed, ["first", "fails"]);
  assert.deepEqual(result, { failedStep: "fails", ok: false, status: 17 });
});

test("a failed file transaction restores existing files and removes new files", () => {
  const rootDir = temporaryRepository();
  const existing = path.join(rootDir, "existing.md");
  const created = path.join(rootDir, "created.md");
  fs.writeFileSync(existing, "before\n", "utf8");

  assert.throws(() =>
    withFileTransaction([existing, created], () => {
      fs.writeFileSync(existing, "after\n", "utf8");
      fs.writeFileSync(created, "partial\n", "utf8");
      throw new Error("simulated sprint update failure");
    })
  );
  assert.equal(fs.readFileSync(existing, "utf8"), "before\n");
  assert.equal(fs.existsSync(created), false);
});

test("atomic writes leave an unchanged file untouched", () => {
  const rootDir = temporaryRepository();
  const filePath = path.join(rootDir, "unchanged.md");
  fs.writeFileSync(filePath, "stable\n", "utf8");
  const before = fs.statSync(filePath);

  assert.equal(writeFileAtomic(filePath, "stable\n"), false);
  const after = fs.statSync(filePath);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(after.ino, before.ino);
});

test("generated Markdown tables are already Prettier-aligned", () => {
  assert.equal(
    table(
      ["Item", "Value"],
      [
        ["Member", "M1"],
        ["Validation status", "Passed"]
      ]
    ),
    [
      "| Item              | Value  |",
      "| ----------------- | ------ |",
      "| Member            | M1     |",
      "| Validation status | Passed |"
    ].join("\n")
  );
});

test("private package versions stay synchronized without equating them to app or sprint versions", () => {
  const rootDir = temporaryRepository();
  for (const workspace of ["frontend", "backend", "electron"]) {
    fs.mkdirSync(path.join(rootDir, workspace), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, workspace, "package.json"),
      `${JSON.stringify({ name: workspace, private: true, version: "0.1.0" }, null, 2)}\n`
    );
  }
  fs.writeFileSync(
    path.join(rootDir, "package.json"),
    `${JSON.stringify({ name: "root", private: true, version: "0.1.0" }, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(rootDir, "package-lock.json"),
    `${JSON.stringify(
      {
        lockfileVersion: 3,
        name: "root",
        packages: {
          "": { name: "root", version: "0.1.0" },
          backend: { version: "0.1.0" },
          electron: { version: "0.1.0" },
          frontend: { version: "0.1.0" }
        },
        version: "0.1.0"
      },
      null,
      2
    )}\n`
  );
  fs.mkdirSync(path.join(rootDir, "frontend", "src", "config"), { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, "frontend", "src", "config", "appVersion.ts"),
    'export const APP_VERSION = "0.2.0";\n'
  );

  assert.deepEqual(checkVersionConsistency(rootDir), {
    appVersion: "0.2.0",
    errors: [],
    packageVersion: "0.1.0"
  });
});

test("version consistency reports a mismatched workspace or lockfile", () => {
  const rootDir = temporaryRepository();
  for (const workspace of ["frontend", "backend", "electron"]) {
    fs.mkdirSync(path.join(rootDir, workspace), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, workspace, "package.json"),
      `${JSON.stringify({ name: workspace, private: true, version: workspace === "backend" ? "0.2.0" : "0.1.0" })}\n`
    );
  }
  fs.writeFileSync(path.join(rootDir, "package.json"), '{"version":"0.1.0"}\n');
  fs.writeFileSync(
    path.join(rootDir, "package-lock.json"),
    '{"version":"0.1.0","packages":{"":{"version":"0.1.0"},"frontend":{"version":"0.1.0"},"backend":{"version":"0.1.0"},"electron":{"version":"0.1.0"}}}\n'
  );
  fs.mkdirSync(path.join(rootDir, "frontend", "src", "config"), { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, "frontend", "src", "config", "appVersion.ts"),
    'export const APP_VERSION = "0.2.0";\n'
  );

  const result = checkVersionConsistency(rootDir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /backend\/package\.json.*0\.2\.0.*0\.1\.0/i);
});

test("dependency audit policy separates development-only and production-reachable findings", () => {
  const report = {
    vulnerabilities: {
      "deepmerge-ts": {
        isDirect: false,
        nodes: ["node_modules/deepmerge-ts"],
        severity: "high"
      },
      "runtime-parser": {
        isDirect: false,
        nodes: ["node_modules/runtime-parser"],
        severity: "high"
      }
    }
  };
  const lockfile = {
    packages: {
      "": {
        dependencies: { "runtime-parser": "1.0.0" },
        devDependencies: { "deepmerge-ts": "7.1.5" }
      },
      "node_modules/deepmerge-ts": { dev: true, version: "7.1.5" },
      "node_modules/runtime-parser": { version: "1.0.0" }
    }
  };

  const result = auditPolicy.classifyAuditVulnerabilities(report, lockfile);
  assert.deepEqual(
    result.developmentOnly.map((item) => item.name),
    ["deepmerge-ts"]
  );
  assert.deepEqual(
    result.productionReachable.map((item) => item.name),
    ["runtime-parser"]
  );
});

test("security audit rejects registry errors and incomplete reports", () => {
  assert.throws(
    () => auditPolicy.assertCompleteAuditReport({ error: { code: "ENOAUDIT" } }, 1),
    /npm audit failed.*ENOAUDIT/i
  );
  assert.throws(
    () => auditPolicy.assertCompleteAuditReport({ auditReportVersion: 2, metadata: {} }, 0),
    /vulnerabilities.*missing/i
  );
  assert.throws(
    () => auditPolicy.assertCompleteAuditReport({ auditReportVersion: 2, vulnerabilities: {} }, 0),
    /metadata.*missing/i
  );
  assert.throws(
    () =>
      auditPolicy.assertCompleteAuditReport(
        {
          auditReportVersion: 2,
          metadata: { vulnerabilities: { total: 1 } },
          vulnerabilities: {}
        },
        1
      ),
    /inconsistent.*total/i
  );
});

test("ambiguous optional production paths are classified as production-reachable", () => {
  const report = {
    vulnerabilities: {
      vuln: {
        isDirect: false,
        nodes: ["node_modules/vuln"],
        severity: "critical"
      }
    }
  };
  const lockfile = {
    packages: {
      "": { dependencies: { runtime: "1.0.0" } },
      "node_modules/runtime": { optionalDependencies: { vuln: "1.0.0" } },
      "node_modules/vuln": { devOptional: true, version: "1.0.0" }
    }
  };

  const result = auditPolicy.classifyAuditVulnerabilities(report, lockfile);
  assert.deepEqual(
    result.productionReachable.map((item) => item.name),
    ["vuln"]
  );
  assert.deepEqual(result.developmentOnly, []);
});

test("artifact validation records only the aggregate command that actually ran", () => {
  assert.deepEqual(validationSummary.aggregateValidationRows("Passed"), [
    {
      command: "npm run verify:code",
      notes: "The aggregate read-only code verification completed successfully.",
      result: "Passed"
    }
  ]);
});

test("CI includes read-only preflight and status verification without status mutation", () => {
  const workflow = fs.readFileSync(path.join(REPO_ROOT, ".github", "workflows", "ci.yml"), "utf8");

  assert.match(workflow, /npm run guardrail:preflight -- --member m1/);
  assert.match(workflow, /npm run verify:status -- --member m1/);
  assert.doesNotMatch(workflow, /npm run status:update/);
});

test("Markdown table updates preserve a UTF-8 BOM and CRLF line endings", () => {
  const rootDir = temporaryRepository();
  const filePath = path.join(rootDir, "evidence.md");
  fs.writeFileSync(
    filePath,
    "\ufeff# Evidence\r\n\r\n## Validation Results\r\n\r\n| Date | Result |\r\n| --- | --- |\r\n| 2026-08-18 | Pending |\r\n",
    "utf8"
  );

  upsertTableRow(filePath, "Validation Results", ["Date"], {
    Date: "2026-08-18",
    Result: "Passed"
  });

  const updated = fs.readFileSync(filePath, "utf8");
  assert.equal(updated.startsWith("\ufeff"), true);
  assert.equal(/(?<!\r)\n/.test(updated), false);
  assert.match(updated, /\| 2026-08-18 \| Passed \|\r\n$/);
});

test("artifact evidence rejects malformed headings and unexecuted command passes", () => {
  const content = [
    "# Validation Summary",
    "",
    "## Validation Results| Date | Branch | Command | Result | Notes |",
    "",
    "| 2026-08-18 | sprint/v0.4/sprint-4 | npm audit --audit-level=high | Passed | Completed successfully. |",
    ""
  ].join("\n");

  const issues = validationSummary.artifactEvidenceIssues(content, {
    branch: "sprint/v0.4/sprint-4",
    date: "2026-08-18"
  });
  assert.equal(
    issues.some((issue) => /malformed heading/i.test(issue)),
    true
  );
  assert.equal(
    issues.some((issue) => /unverified command.*npm audit/i.test(issue)),
    true
  );
});

test("Prettier check reports formatting without modifying the file", () => {
  const rootDir = temporaryRepository();
  const filePath = path.join(rootDir, "sample.js");
  fs.writeFileSync(filePath, "const value={answer:42}\n", "utf8");
  const before = fs.readFileSync(filePath);
  const prettierBin = path.join(REPO_ROOT, "node_modules", "prettier", "bin", "prettier.cjs");

  const result = spawnSync(process.execPath, [prettierBin, "--check", filePath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false
  });

  assert.equal(result.status, 1);
  assert.deepEqual(fs.readFileSync(filePath), before);
});

test.after(() => {
  execFileSync("git", ["diff", "--check"], { cwd: REPO_ROOT, stdio: "pipe" });
});
