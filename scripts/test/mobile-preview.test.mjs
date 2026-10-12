import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

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
  assert.match(launcher, /state === "backend-only"/);
  assert.match(launcher, /response\.ok && payload\?\.data\?\.service === "ysabellestore-backend"/);
  assert.match(launcher, /payload\?\.data\?\.checks\?\.database !== "connected"/);
  assert.match(launcher, /if \(!backendOccupied && !frontendOccupied\) return "none";/);
  assert.match(launcher, /probeStack\(\)\) === "backend-only"/);
  assert.doesNotMatch(launcher, /fetch\(runtime\.frontendUrl/);
  assert.match(launcher, /predev:web/);
  assert.match(launcher, /--web-only/);
  assert.match(launcher, /Reusing the existing YsabelleStore web server/);
  assert.match(launcher, /Reusing the healthy YsabelleStore backend/);
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
  assert.match(page, /data-view="welcome" data-route="\/\?preview=welcome"/);
  assert.match(page, /data-view="pos" data-route="\/pos"/);
  assert.match(page, /data-view="dashboard" data-route="\/dashboard"/);
  assert.match(page, /data-view="storefront" data-route="\/shop"/);
  assert.match(page, /<iframe[^>]+src="\/\?preview=welcome"/);
  assert.match(page, /window\.addEventListener\("hashchange"/);
  assert.match(page, /button\.setAttribute\("aria-pressed"/);
  const customerApp = read("frontend/src/app/CustomerApp.tsx");
  assert.match(customerApp, /import\.meta\.env\.VITE_MOBILE_PREVIEW === "1"/);
  assert.match(customerApp, /locationUrl\.searchParams\.get\("preview"\) === "welcome"/);
  assert.match(page, /Layout preview only/);
  assert.doesNotMatch(page, /http:\/\/localhost:3001/);
});

test("preview route selection restores from hash, highlights the active view and supports reselect", () => {
  const page = read("frontend/mobile-preview.html");
  const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "Missing mobile preview script");

  function element(attributes = {}) {
    const listeners = new Map();
    return {
      style: {},
      attributes: { ...attributes },
      clientWidth: 900,
      value: "390,844",
      textContent: "",
      addEventListener(name, callback) {
        listeners.set(name, callback);
      },
      getAttribute(name) {
        return this.attributes[name] ?? null;
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      trigger(name) {
        listeners.get(name)?.();
      }
    };
  }

  const buttons = [
    ["welcome", "/?preview=welcome"],
    ["storefront", "/shop"],
    ["pos", "/pos"],
    ["dashboard", "/dashboard"]
  ].map(([view, route]) => {
    const button = element({ "data-view": view, "data-route": route });
    button.dataset = { view, route };
    return button;
  });
  const preview = element({ src: "/?preview=welcome" });
  Object.defineProperty(preview, "src", {
    get() { return this.attributes.src; },
    set(value) { this.attributes.src = value; }
  });
  const fullPage = element();
  const ids = {
    device: element(),
    stage: element(),
    mount: element(),
    frame: element(),
    preview,
    dimensions: element(),
    rotate: element(),
    "full-page-link": fullPage
  };
  const events = new Map();
  const fakeWindow = {
    innerHeight: 1080,
    location: { hash: "#dashboard" },
    addEventListener(name, callback) { events.set(name, callback); }
  };

  runInNewContext(script, {
    document: {
      getElementById(id) { return ids[id]; },
      querySelectorAll(selector) {
        assert.equal(selector, "[data-view][data-route]");
        return buttons;
      }
    },
    window: fakeWindow
  });

  assert.equal(preview.src, "/dashboard");
  assert.equal(fullPage.href, "/dashboard");
  assert.equal(buttons[3].getAttribute("aria-pressed"), "true");
  assert.equal(buttons[0].getAttribute("aria-pressed"), "false");

  buttons[0].trigger("click");
  assert.equal(preview.src, "/?preview=welcome");
  assert.equal(fullPage.href, "/?preview=welcome");
  assert.equal(fakeWindow.location.hash, "welcome");
  assert.equal(buttons[0].getAttribute("aria-pressed"), "true");
  assert.equal(buttons[3].getAttribute("aria-pressed"), "false");

  preview.src = "/"; // Simulate navigating through Get Started inside the iframe.
  buttons[0].trigger("click");
  assert.equal(preview.src, "/?preview=welcome", "Reselecting Welcome must restore the entrance");

  fakeWindow.location.hash = "#storefront";
  events.get("hashchange")();
  assert.equal(preview.src, "/shop");
  assert.equal(fullPage.href, "/shop");
  assert.equal(buttons[1].getAttribute("aria-pressed"), "true");

  fakeWindow.location.hash = "#not-a-route";
  events.get("hashchange")();
  assert.equal(preview.src, "/?preview=welcome");
});

test("store entrance fits short landscape phone viewports without scroll clipping", () => {
  const css = read("frontend/src/styles/customer-home-premium.css");
  const shortLandscape = css.split(
    "@media (max-width: 950px) and (max-height: 440px)"
  )[1]?.split("/* Home becomes shopping-first")[0];

  assert.ok(shortLandscape, "Missing short-height responsive rule");
  assert.match(shortLandscape, /\.store-entrance\s*\{[^}]*height: 100svh;/);
  assert.match(
    shortLandscape,
    /\.store-entrance__content\s*\{[^}]*height: 100svh;[^}]*min-height: 0;/
  );
  assert.match(shortLandscape, /\.store-entrance__brand-mark\s*\{[^}]*31svh/);
  assert.match(shortLandscape, /\.store-entrance h1\s*\{[^}]*7\.5svh/);
  assert.match(shortLandscape, /\.store-entrance__enter\s*\{[^}]*min-height: 40px;/);
  assert.doesNotMatch(shortLandscape, /overflow:\s*hidden/);
});
