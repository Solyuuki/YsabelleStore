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
  const backendConfig = read("backend/src/config/env.ts");

  assert.equal(pkg.scripts["dev:mob"], "node --env-file=.env scripts/dev-mobile.mjs");
  assert.equal(
    pkg.scripts["test:mobile"],
    "node --test scripts/test/mobile-preview.test.mjs scripts/test/storefront-adaptive-mobile.test.mjs"
  );

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
  assert.match(launcher, /await assertMobileFavoriteOriginAllowed\(\)/);
  assert.match(launcher, /Origin: MOBILE_ORIGIN/);
  assert.match(launcher, /CUSTOMER_AUTH_ORIGIN_REJECTED/);
  assert.ok(backendConfig.includes('"http://localhost:5174"'));
  assert.ok(backendConfig.includes('"http://127.0.0.1:5174"'));
  assert.match(backendConfig, /address\.family === "IPv4"/);
  assert.match(backendConfig, /env\.NODE_ENV === "production"/);
  assert.match(vite, /mobilePreview \? "0\.0\.0\.0" : frontendUrl\.hostname/);
  assert.match(vite, /mobilePreview \? 5174 : Number\(frontendUrl\.port\)/);
  assert.match(vite, /strictPort: true/);
  assert.match(vite, /"\/api": \{/);
  assert.match(vite, /Mobile preview may proxy only to a local development API/);
  // Node/TSX contract tests don't inject import.meta.env like Vite does.
  // The mobile proxy branch must be guarded without changing the Vite behavior.
  assert.match(frontend, /import\.meta\.env\?\.DEV/);
  assert.match(frontend, /import\.meta\.env\?\.VITE_MOBILE_PREVIEW === "1"/);
  assert.match(frontend, /typeof window !== "undefined"/);
  assert.match(frontend, /window\.location\.origin/);
});

test("frontend runtime can load without Vite-injected import.meta.env", async () => {
  const runtime = read("frontend/src/config/runtime.ts");
  // Exercise the same runtime code under native Node ESM without introducing
  // the browser-only Vite variables. Stub only the imported env schema and
  // erase the two TypeScript parameter/return annotations for this probe.
  const executable = runtime
    .replace(
      'import { frontendEnv } from "@/schemas/frontendEnv.schema";',
      'const frontendEnv = { VITE_API_BASE_URL: "http://localhost:3001", VITE_APP_NAME: "YsabelleStore", VITE_APP_VERSION: "0.1.0" };'
    )
    .replace("resolveApiUrl(path: string): URL", "resolveApiUrl(path)");
  assert.notEqual(executable, runtime, "Runtime Node probe must replace its imported schema");
  assert.doesNotMatch(executable, /resolveApiUrl\(path: string\)/);

  const url = `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`;
  const { frontendRuntimeConfig, resolveApiUrl } = await import(url);
  assert.equal(frontendRuntimeConfig.apiBaseUrl, "http://localhost:3001");
  assert.equal(frontendRuntimeConfig.appName, "YsabelleStore");
  assert.equal(resolveApiUrl("/api/customer-auth/me").pathname, "/api/customer-auth/me");
});

test("mobile preview supports portrait-only phones, rotating tablets and live routes", () => {
  const page = read("frontend/mobile-preview.html");

  for (const width of ["320,640", "360,800", "390,844", "430,932", "768,1024"]) {
    assert.ok(page.includes(width), "Missing preview width: " + width);
  }
  assert.match(page, /<iframe[^>]+title="YsabelleStore\s*live\s*mobile\s*viewport"/);
  assert.match(page, /id="rotate"[^>]+disabled/);
  for (const phone of ["320,640", "360,800", "375,812", "390,844", "412,915", "430,932"]) {
    assert.ok(page.includes(`data-orientation="portrait" value="${phone}"`));
  }
  assert.match(page, /data-orientation="both"\s*value="768,\s*1024"/);
  assert.match(page, /id="orientation-hint"/);
  assert.match(page, /rotateButton\.disabled\s*=\s*!tablet/);
  assert.match(page, /if\s*\(!canRotate\(\)\)\s*return;/);
  assert.match(page, /if\s*\(!tablet\)\s*landscape\s*=\s*false;/);
  assert.match(page, /data-view="welcome"\s*data-route="\/\?preview=welcome"/);
  assert.match(page, /data-view="pos"\s*data-route="\/pos"/);
  assert.match(page, /data-view="dashboard"\s*data-route="\/dashboard"/);
  assert.match(page, /data-view="storefront"\s*data-route="\/shop"/);
  assert.match(page, /<iframe[^>]+src="\/\?preview=welcome"/);
  assert.match(page, /window\.addEventListener\("hashchange"/);
  assert.match(page, /button\.setAttribute\("aria-pressed"/);
  const customerApp = read("frontend/src/app/CustomerApp.tsx");
  assert.match(customerApp, /import\.meta\.env\.VITE_MOBILE_PREVIEW\s*===\s*"1"/);
  assert.match(customerApp, /locationUrl\.searchParams\.get\("preview"\)\s*===\s*"welcome"/);
  assert.match(page, /Layout\s*preview\s*only/);
  assert.doesNotMatch(page, /http:\/\/localhost:3001/);
});

test("Google Quick Sign escapes the embedded phone preview before OAuth", () => {
  const service = read("frontend/src/services/customerSocialAuthService.ts");
  const preview = read("frontend/mobile-preview.html");
  const login = read("frontend/src/pages/customer/CustomerLoginPage.tsx");
  const register = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");

  assert.match(service, /customerSocialAuthNavigationWindow\(currentWindow:\s*Window\):\s*Window/);
  assert.match(
    service,
    /if\s*\(currentWindow\.self\s*===\s*currentWindow\.top\)\s*return\s*currentWindow;/
  );
  assert.match(service, /parent\s*===\s*currentWindow\.top/);
  assert.match(service, /parent\.location\.origin\s*===\s*currentWindow\.location\.origin/);
  assert.match(service, /parent\.location\.pathname\s*===\s*"\/mobile-preview\.html"/);
  assert.match(
    service,
    /throw\s*new\s*Error\([\s\S]*?Open\s*Ysabelle\s*Store\s*in\s*a\s*full\s*browser\s*tab/
  );
  assert.match(service, /authWindow\.location\.assign\(url\.toString\(\)\)/);
  assert.match(login, /startCustomerSocialAuth\(provider,\s*\s*quickSignReturnTo,\s*\s*"login"\)/);
  assert.match(register, /startCustomerSocialAuth\(provider,\s*\s*returnTo,\s*\s*"register"\)/);
  assert.match(preview, /Google\s*Quick\s*Sign\s*opens\s*the\s*full\s*browser\s*page/);
});

test("OAuth returns to the signed-in mobile preview, restores the viewport and clears stale routing", () => {
  const page = read("frontend/mobile-preview.html");
  const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "Missing embedded preview controller");

  function runPreview(address, orientation = "portrait") {
    function element(attributes = {}) {
      const listeners = new Map();
      return {
        attributes: { ...attributes },
        style: {},
        clientWidth: 1000,
        value: "390,844",
        selectedOptions: [{ dataset: { orientation } }],
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
      const node = element({ "data-view": view, "data-route": route });
      node.dataset = { view, route };
      return node;
    });
    const iframe = element({ src: "/?preview=welcome" });
    Object.defineProperty(iframe, "src", {
      get() {
        return this.attributes.src;
      },
      set(value) {
        this.attributes.src = value;
      }
    });
    const inputs = {
      device: element(),
      stage: element(),
      mount: element(),
      frame: element(),
      preview: iframe,
      dimensions: element(),
      rotate: element(),
      "orientation-hint": element(),
      "full-page-link": element()
    };
    inputs.device.selectedOptions = [{ dataset: { orientation } }];
    const parsed = new URL(address);
    let redirect = null;
    let cleanedPath = null;
    const win = {
      innerHeight: 1200,
      location: {
        href: parsed.href,
        origin: parsed.origin,
        hostname: parsed.hostname,
        port: parsed.port,
        search: parsed.search,
        hash: parsed.hash,
        replace(href) {
          redirect = href;
        }
      },
      history: {
        replaceState(_state, _title, path) {
          cleanedPath = path;
        }
      },
      addEventListener() {}
    };
    runInNewContext(script, {
      window: win,
      URL,
      URLSearchParams,
      document: {
        getElementById(id) {
          return inputs[id];
        },
        querySelectorAll() {
          return buttons;
        }
      }
    });
    return {
      buttons,
      iframe,
      inputs,
      redirect: () => redirect,
      cleanedPath: () => cleanedPath
    };
  }

  const phone = runPreview(
    "http://localhost:5174/mobile-preview.html?authRoute=%2Faccount&authDevice=390%2C844"
  );
  assert.equal(phone.iframe.src, "/account");
  assert.equal(phone.inputs["full-page-link"].href, "/account");
  assert.equal(phone.buttons[1].getAttribute("aria-pressed"), "true");
  assert.equal(phone.inputs.dimensions.textContent, "390 × 844 CSS pixels");
  phone.buttons[2].trigger("click");
  assert.equal(phone.iframe.src, "/pos");
  assert.equal(phone.cleanedPath(), "/mobile-preview.html#pos");

  const tablet = runPreview(
    "http://localhost:5174/mobile-preview.html?authRoute=%2Faccount%3Fview%3Dprofile&authDevice=768%2C1024&authLandscape=1",
    "both"
  );
  assert.equal(tablet.iframe.src, "/account?view=profile");
  assert.equal(tablet.inputs.dimensions.textContent, "1024 × 768 CSS pixels");

  const canonicalCallback = runPreview(
    "http://localhost:5173/mobile-preview.html?authRoute=%2Faccount&authDevice=390%2C844&authPreviewPort=5174"
  );
  const handoff = new URL(canonicalCallback.redirect());
  assert.equal(handoff.origin, "http://localhost:5174");
  assert.equal(handoff.searchParams.get("authRoute"), "/account");
  assert.equal(handoff.searchParams.has("authPreviewPort"), false);

  const malicious = runPreview(
    "http://localhost:5174/mobile-preview.html?authRoute=%2F%2Fevil.example%2F"
  );
  assert.equal(malicious.iframe.src, "/?preview=welcome");
});

test("phones and tablets browse without a fullscreen orientation blocker", () => {
  const html = read("frontend/index.html");
  const css = read("frontend/src/styles/global.css");
  const qa = read("tools/mobile-qa/run.mjs");

  assert.doesNotMatch(html, /phone-orientation-notice|Rotate your phone upright/);
  assert.doesNotMatch(css, /\.phone-orientation-notice/);
  assert.doesNotMatch(qa, /portrait notice visible|screen\.orientation\.lock/);

  assert.match(qa, /\{ name: "phone-landscape", width: 640, height: 320 \}/);
  assert.match(qa, /\{ name: "tablet", width: 768, height: 1024 \}/);
  assert.match(qa, /\{ name: "tablet-landscape", width: 1024, height: 768 \}/);
  assert.match(qa, /Deprecated phone orientation overlay is still present/);
  assert.match(qa, /const result = await measurePage\(page, viewport\)/);
  assert.match(qa, /Document overflow:/);
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
      selectedOptions: [{ dataset: { orientation: "portrait" } }],
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
    get() {
      return this.attributes.src;
    },
    set(value) {
      this.attributes.src = value;
    }
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
    "orientation-hint": element(),
    "full-page-link": fullPage
  };
  const events = new Map();
  const fakeWindow = {
    innerHeight: 1080,
    location: { hash: "#dashboard" },
    addEventListener(name, callback) {
      events.set(name, callback);
    }
  };

  runInNewContext(script, {
    document: {
      getElementById(id) {
        return ids[id];
      },
      querySelectorAll(selector) {
        assert.equal(selector, "[data-view][data-route]");
        return buttons;
      }
    },
    window: fakeWindow,
    URLSearchParams
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

  // Phone presets remain portrait even if the user clicks Rotate.
  assert.equal(ids.rotate.disabled, true);
  assert.equal(ids.dimensions.textContent, "390 × 844 CSS pixels");
  assert.equal(ids["orientation-hint"].textContent, "Phone · portrait only");
  ids.rotate.trigger("click");
  assert.equal(ids.dimensions.textContent, "390 × 844 CSS pixels");

  // Only the tablet preset enables rotation in either direction.
  ids.device.value = "768,1024";
  ids.device.selectedOptions[0].dataset.orientation = "both";
  ids.device.trigger("change");
  assert.equal(ids.rotate.disabled, false);
  assert.equal(ids.dimensions.textContent, "768 × 1024 CSS pixels");
  assert.equal(ids["orientation-hint"].textContent, "Tablet · portrait and landscape");
  ids.rotate.trigger("click");
  assert.equal(ids.dimensions.textContent, "1024 × 768 CSS pixels");
  ids.rotate.trigger("click");
  assert.equal(ids.dimensions.textContent, "768 × 1024 CSS pixels");

  // Switching back from a landscape tablet must force portrait on the phone.
  ids.rotate.trigger("click");
  ids.device.value = "320,640";
  ids.device.selectedOptions[0].dataset.orientation = "portrait";
  ids.device.trigger("change");
  assert.equal(ids.rotate.disabled, true);
  assert.equal(ids.dimensions.textContent, "320 × 640 CSS pixels");
  ids.rotate.trigger("click");
  assert.equal(ids.dimensions.textContent, "320 × 640 CSS pixels");
});

test("store entrance fits short landscape phone viewports without scroll clipping", () => {
  const css = read("frontend/src/styles/customer-home-premium.css");
  const shortLandscape = css
    .split("@media (max-width: 950px) and (max-height: 440px)")[1]
    ?.split("/* Home becomes shopping-first")[0];

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

test("320px welcome keeps the two intended title lines centered without changing entrance behavior", () => {
  const entrance = read("frontend/src/components/customer/StoreEntrance.tsx");
  const css = read("frontend/src/styles/customer-home-premium.css");
  const narrow = css
    .split("/* At 320px portrait, fit the authored two-line welcome headline")[1]
    ?.split("/* A phone in landscape can be only 320-430px tall.")[0];

  assert.ok(narrow, "Missing 320px entrance typography");
  assert.match(entrance, /<span>Your Neighborhood Store<\/span>\s*<span>Now Online\.<\/span>/);
  assert.match(narrow, /@media \(max-width: 359px\) and \(orientation: portrait\)/);
  assert.match(
    narrow,
    /\.store-entrance h1\s*\{[^}]*font-size: clamp\(1\.35rem, 6\.7vw, 1\.52rem\);/
  );
  assert.match(narrow, /\.store-entrance h1 span:first-child\s*\{\s*white-space: nowrap;/);
  assert.match(
    css,
    /\.store-entrance__content\s*\{[^}]*align-items: center;[^}]*justify-content: center;/
  );
  assert.match(css, /\.store-entrance h1\s*\{[^}]*text-wrap: balance;/);
  assert.match(entrance, /onClick=\{enterStore\}/);
});
