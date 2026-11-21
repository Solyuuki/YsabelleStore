import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function loadVercelConfig(origin) {
  const environment = { ...process.env };
  delete environment.RENDER_API_ORIGIN;
  if (origin !== undefined) environment.RENDER_API_ORIGIN = origin;
  return spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", "import { config } from './vercel.mjs'; console.log(JSON.stringify(config));"],
    { cwd: root, env: environment, encoding: "utf8" }
  );
}

test("deployment fails closed without a Render API origin", () => {
  const output = loadVercelConfig(undefined);
  assert.notEqual(output.status, 0);
  assert.match(output.stderr, /RENDER_API_ORIGIN is required/);
});

test("deployment rejects unsafe or malformed Render origin", () => {
  for (const origin of [
    "http://example.onrender.com",
    "https://example.onrender.com/api",
    "https://example.onrender.com/?token=x",
    "https://example.onrender.com/#hash",
    "https://user:secret@example.onrender.com",
    "javascript:alert(1)"
  ]) {
    const output = loadVercelConfig(origin);
    assert.notEqual(output.status, 0, `Should reject ${origin}`);
  }
});

test("Vercel builds the frontend and first-party-proxies API to Render", () => {
  const output = loadVercelConfig("https://example.onrender.com/");
  assert.equal(output.status, 0, output.stderr);
  const config = JSON.parse(output.stdout.trim());
  assert.equal(config.framework, "vite");
  assert.equal(config.outputDirectory, "frontend/dist");
  assert.match(config.buildCommand, /VITE_FIRST_PARTY_API=1/);
  assert.match(config.buildCommand, /@ysabellestore\/frontend/);
  assert.deepEqual(config.rewrites, [
    { source: "/api", destination: "https://example.onrender.com/api" },
    { source: "/api/:path*", destination: "https://example.onrender.com/api/:path*" },
    { source: "/(.*)", destination: "/index.html" }
  ]);
});

test("Render branch and Docker backend retain health and Python runtime", () => {
  const render = readFileSync(resolve(root, "render.yaml"), "utf8");
  const docker = readFileSync(resolve(root, "deployment/render/backend.Dockerfile"), "utf8");
  const runtime = readFileSync(resolve(root, "frontend/src/config/runtime.ts"), "utf8");
  const callback = readFileSync(
    resolve(root, "backend/src/controllers/customerSocialAuthController.ts"),
    "utf8"
  );
  assert.match(render, /branch: Deployment/);
  assert.match(render, /plan: free/);
  assert.match(render, /healthCheckPath: \/api\/health\/live/);
  assert.match(render, /DATABASE_URL[\s\S]*sync: false/);
  assert.match(docker, /npm run prisma:generate/);
  assert.match(docker, /@ysabellestore\/backend/);
  assert.match(docker, /forecast-requirements\.txt/);
  assert.match(docker, /NODE_ENV=production/);
  assert.match(runtime, /VITE_FIRST_PARTY_API/);
  assert.match(callback, /_ysabelle_first_party/);
});
