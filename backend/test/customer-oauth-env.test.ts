import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

test("blank optional social provider credentials are treated as unconfigured", () => {
  const probe = spawnSync(
    npxCommand,
    [
      "--no-install",
      "tsx",
      "-e",
      'import("./src/config/env.ts").then(({ env }) => console.log(JSON.stringify({ googleClientId: env.GOOGLE_OAUTH_CLIENT_ID ?? null, facebookAppId: env.FACEBOOK_OAUTH_APP_ID ?? null })))'
    ],
    {
      cwd: backendRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
        GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
        FACEBOOK_OAUTH_APP_ID: "",
        FACEBOOK_OAUTH_APP_SECRET: "",
        CUSTOMER_OAUTH_TRANSACTION_KEY: "phase6-env-test-oauth-transaction-key-32-bytes"
      }
    }
  );

  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
  assert.match(probe.stdout, /"googleClientId":"google-client-id"/);
  assert.match(probe.stdout, /"facebookAppId":null/);
});
