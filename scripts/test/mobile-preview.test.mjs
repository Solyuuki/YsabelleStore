import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("mobile mode shares the existing backend and uses a separate Vite port", () => {
  const pkg = JSON.parse(read("package.json"));
  const launcher = read("scripts/dev-mobile.mjs");
  const vite = read("frontend/vite.config.ts");
  const frontend = read("frontend/src/config/runtime.ts");

  assert.equal(pkg.scripts["dev:mob"], "node --env-file=.env scripts/dev-mobile.mjs");
  assert.equal(pkg.scripts["test:mobile"], "node --test scripts/test/mobile-preview.test.mjs");

  assert.match(launcher, /const MOBILE_PORT = 5174/);
  assert.match(launcher, /const state = await probeStack\(\)/);
  assert.match(launcher, /state === "partial"/);
  assert.match(launcher, /state === "none"/);
  assert.match(launcher, /predev:web/);
  assert.match(launcher, /--web-only/);
  assert.match(launcher, /Reusing the existing YsabelleStore web server/);
  assert.match(launcher, /YSABELLE_MOBILE_PREVIEW: "1"/);
  assert.match(launcher, /VITE_MOBILE_PREVIEW: "1"/);
  assert.match(launcher, /ownedStack\.send\(\{ type: "shutdown" \}\)/);
  assert.match(launcher, /probePreview\(\)/);
  assert.match(launcher, /Mobile preview may not|local development backend/);
  assert.match(vite, /mobilePreview \? "0\.0\.0\.0" : frontendUrl\.hostname/);
  assert.match(vite, /mobilePreview \? 5174 : Number\(frontendUrl\.port\)/);
  assert.match(vite, /strictPort: true/);
  assert.match(vite, /"\/api": \{/);
  assert.match(vite, /Mobile preview may proxy only to a local development API/);
  assert.match(frontend, /import\.meta\.env\.VITE_MOBILE_PREVIEW === "1"/);
  assert.match(frontend, /window\.location\.origin/);
});

test("mobile preview supports phone sizes, rotation and live routes", () => {
  const page = read("frontend/mobile-preview.html");

  for (const width of ["320,640", "360,800", "390,844", "430,932", "768,1024"]) {
    assert.ok(page.includes(width), "Missing preview width: " + width);
  }
  assert.match(page, /<iframe[^>]+title="YsabelleStore live mobile viewport"/);
  assert.match(page, /id="rotate"/);
  assert.match(page, /data-route="\/pos"/);
  assert.match(page, /data-route="\/dashboard"/);
  assert.match(page, /data-route="\/shop"/);
  assert.match(page, /Layout preview only/);
  assert.doesNotMatch(page, /http:\/\/localhost:3001/);
});
