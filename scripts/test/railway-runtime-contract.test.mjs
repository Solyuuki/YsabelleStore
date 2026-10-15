import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const file = (path) => readFileSync(path, "utf8");

test("Railway has explicit frontend and Python-enabled backend images", () => {
  const frontend = file("deployment/railway/frontend.Dockerfile");
  const backend = file("deployment/railway/backend.Dockerfile");
  assert.match(frontend, /VITE_API_BASE_URL/);
  assert.match(frontend, /YSABELLE_WEB_DEPLOY=1/);
  assert.match(frontend, /static-server\.mjs/);
  assert.match(backend, /prisma:generate/);
  assert.match(backend, /forecasting-service\/requirements\.txt/);
  assert.match(backend, /CATALOG_IMAGE_STORAGE_ROOT=\/data\/catalog-images/);
  assert.doesNotMatch(backend, /prisma db push|db:seed|--force-reset/);
});

test("Railway images exclude environment secrets and local data", () => {
  const ignore = file(".dockerignore");
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\*\.sql$/m);
  assert.match(ignore, /^\*\*\/\.data$/m);
});

test("Railway web routing has absolute assets and safe SPA fallback", () => {
  const vite = file("frontend/vite.config.ts");
  const server = file("deployment/railway/static-server.mjs");
  assert.match(vite, /YSABELLE_WEB_DEPLOY/);
  assert.match(server, /index\.html/);
  assert.match(server, /startsWith\("\/api\/"\)/);
});
