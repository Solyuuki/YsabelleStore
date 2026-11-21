import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));

test("Vercel builds frontend in first-party API mode", () => {
  assert.equal(vercel.framework, "vite");
  assert.equal(vercel.outputDirectory, "frontend/dist");
  assert.equal(vercel.installCommand, "npm ci --ignore-scripts");
  assert.match(vercel.buildCommand, /VITE_FIRST_PARTY_API=1/);
  assert.match(vercel.buildCommand, /@ysabellestore\/frontend/);
});

test("Vercel rewrites first-party API to Render backend before SPA fallback", () => {
  const origin = "https://ysabellestore-api.onrender.com";
  assert.deepEqual(vercel.rewrites, [
    { source: "/api", destination: `${origin}/api` },
    { source: "/api/:path*", destination: `${origin}/api/:path*` },
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
