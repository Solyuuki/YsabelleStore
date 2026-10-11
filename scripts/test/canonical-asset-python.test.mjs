import assert from "node:assert/strict";
import test from "node:test";

import { pythonInvocationCandidates } from "../canonical-asset-materializer.mjs";

test("Windows Python discovery prefers the py launcher before app aliases", () => {
  assert.deepEqual(pythonInvocationCandidates({ environment: {}, platform: "win32" }), [
    { command: "py", prefix: ["-3"] },
    { command: "python", prefix: [] },
    { command: "python3", prefix: [] }
  ]);
});

test("explicit Python executable overrides platform discovery", () => {
  assert.deepEqual(
    pythonInvocationCandidates({
      environment: { PYTHON_EXECUTABLE: "C:\\Python312\\python.exe" },
      platform: "win32"
    }),
    [{ command: "C:\\Python312\\python.exe", prefix: [] }]
  );
});

test("POSIX Python discovery prefers python3", () => {
  assert.deepEqual(pythonInvocationCandidates({ environment: {}, platform: "linux" }), [
    { command: "python3", prefix: [] },
    { command: "python", prefix: [] }
  ]);
});
