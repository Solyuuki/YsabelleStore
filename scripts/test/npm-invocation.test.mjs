import assert from "node:assert/strict";
import test from "node:test";

import { resolveNpmInvocation } from "../lib/npm-invocation.mjs";

test("npm invocation reuses npm_execpath without a Windows command shim", () => {
  assert.deepEqual(
    resolveNpmInvocation(["run", "prisma:generate"], {
      env: { npm_execpath: "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js" },
      platform: "win32",
      execPath: "C:\\Program Files\\nodejs\\node.exe"
    }),
    {
      command: "C:\\Program Files\\nodejs\\node.exe",
      args: [
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "prisma:generate"
      ],
      shell: false
    }
  );
});

test("Windows direct-node fallback invokes npm through the command shell", () => {
  assert.deepEqual(
    resolveNpmInvocation(["run", "prisma:generate"], {
      env: {},
      platform: "win32",
      execPath: "node.exe"
    }),
    {
      command: "npm",
      args: ["run", "prisma:generate"],
      shell: true
    }
  );
});

test("POSIX direct-node fallback invokes npm directly", () => {
  assert.deepEqual(
    resolveNpmInvocation(["run", "prisma:generate"], {
      env: {},
      platform: "linux",
      execPath: "/usr/bin/node"
    }),
    {
      command: "npm",
      args: ["run", "prisma:generate"],
      shell: false
    }
  );
});
