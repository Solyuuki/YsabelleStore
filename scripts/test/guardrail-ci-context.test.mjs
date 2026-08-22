import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { classifyChanges } from "../lib/change-classifier.mjs";
import { loadGuardrailContext } from "../lib/guardrail-config.mjs";
import { collectChangedFiles, getBranch } from "../lib/git-utils.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function withEnvironment(values, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previous) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function temporaryPullRequestRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ysabelle-ci-context-"));
  git(root, "init", "-b", "main");
  git(root, "config", "user.email", "ci@example.test");
  git(root, "config", "user.name", "CI Test");

  fs.writeFileSync(path.join(root, "base.txt"), "base\n");
  git(root, "add", "base.txt");
  git(root, "commit", "-m", "base");

  git(root, "checkout", "-b", "m2/v0.7/feat/customer-auth");
  fs.writeFileSync(path.join(root, "feature.txt"), "feature\n");
  git(root, "add", "feature.txt");
  git(root, "commit", "-m", "feature");

  git(root, "checkout", "main");
  fs.writeFileSync(path.join(root, "main-only.txt"), "main\n");
  git(root, "add", "main-only.txt");
  git(root, "commit", "-m", "main moved");

  git(root, "checkout", "-b", "pr-merge");
  git(root, "merge", "--no-ff", "m2/v0.7/feat/customer-auth", "-m", "synthetic PR merge");
  git(root, "checkout", "--detach", "HEAD");

  return root;
}

function temporaryGuardrailRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ysabelle-member-context-"));
  fs.mkdirSync(path.join(root, "config"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "sprints", "sprint-7"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "config", "guardrails.json"),
    `${JSON.stringify({ activeSprint: 7 }, null, 2)}\n`
  );
  return root;
}

test("GitHub PR source branch is used when checkout is detached", () => {
  const root = temporaryPullRequestRepository();
  const previousCwd = process.cwd();
  process.chdir(root);

  try {
    withEnvironment(
      {
        GITHUB_ACTIONS: "true",
        GITHUB_HEAD_REF: "m2/v0.7/feat/customer-auth",
        GITHUB_BASE_REF: "main",
        GITHUB_REF_NAME: "123/merge",
        YSABELLE_BRANCH: null,
        YSABELLE_BASE_REF: null
      },
      () => {
        assert.equal(getBranch(), "m2/v0.7/feat/customer-auth");
      }
    );
  } finally {
    process.chdir(previousCwd);
  }
});

test("GitHub PR changed files come from source versus base, not the synthetic merge commit", () => {
  const root = temporaryPullRequestRepository();
  const previousCwd = process.cwd();
  process.chdir(root);

  try {
    withEnvironment(
      {
        GITHUB_ACTIONS: "true",
        GITHUB_HEAD_REF: "m2/v0.7/feat/customer-auth",
        GITHUB_BASE_REF: "main",
        GITHUB_REF_NAME: "123/merge",
        YSABELLE_BRANCH: null,
        YSABELLE_BASE_REF: null
      },
      () => {
        const files = collectChangedFiles().map((item) => item.file);
        assert.deepEqual(files, ["feature.txt"]);
      }
    );
  } finally {
    process.chdir(previousCwd);
  }
});

test("sprint integration guardrail context does not invent an M1 owner", () => {
  const rootDir = temporaryGuardrailRepository();
  const context = loadGuardrailContext({
    args: [],
    branch: "sprint/v0.7/sprint-7",
    memberRequired: false,
    rootDir
  });

  assert.equal(context.member, null);
  assert.equal(context.sprint.sprintNumber, 7);
});

test("member branch guardrail context still resolves the real member", () => {
  const rootDir = temporaryGuardrailRepository();
  const context = loadGuardrailContext({
    args: [],
    branch: "m2/v0.7/feat/customer-auth",
    memberRequired: false,
    rootDir
  });

  assert.equal(context.member?.key, "m2-ramos");
  assert.equal(context.sprint.sprintNumber, 7);
});

test("generic Prisma changes do not manufacture a trusted-device decision", () => {
  const classified = classifyChanges([{ file: "database/prisma/schema.prisma", status: "M" }]);

  assert.equal(
    classified.decisions.some((decision) => /trusted-device/i.test(decision.decision)),
    false
  );
});

test("customer authentication service changes require manual QA", () => {
  const classified = classifyChanges([
    { file: "backend/src/services/customerAuthService.ts", status: "M" }
  ]);

  assert.equal(classified.manualQa, true);
  assert.equal(classified.risky, true);
});
