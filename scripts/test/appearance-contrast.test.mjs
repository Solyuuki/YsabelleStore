import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (name) => readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");

function luminance(hex) {
  const values = hex
    .replace("#", "")
    .match(/../g)
    .map((pair) => parseInt(pair, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

function contrastRatio(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("premium dark tokens meet WCAG AA on their intended solid surfaces", () => {
  const samples = [
    ["primary text / card", "#d4deec", "#1b2638", 4.5],
    ["body text / card", "#b8c6d8", "#1b2638", 4.5],
    ["helper text / card", "#9fafc6", "#1b2638", 4.5],
    ["strong card outline / card", "#687995", "#1b2638", 3],
    ["input text / input", "#d4deec", "#17243a", 4.5],
    ["primary action ink / brand fill", "#111827", "#8f82eb", 4.5]
  ];

  for (const [name, text, surface, threshold] of samples) {
    assert.ok(
      contrastRatio(text, surface) >= threshold,
      `${name} fails contrast: ${contrastRatio(text, surface).toFixed(2)}:1`
    );
  }
});

test("storefront and retail themes use new dark assets rather than light texture", () => {
  const store = read("frontend/src/styles/theme-storefront.css");
  const retail = read("frontend/src/styles/theme-retail.css");
  const component = read("frontend/src/styles/theme-storefront-contrast.css");
  const app = read("frontend/src/app/CustomerApp.tsx");

  assert.ok(store.includes("ys-dark-midnight-velvet.svg"));
  assert.ok(store.includes("ys-dark-indigo-silk.svg"));
  assert.ok(store.includes("ys-dark-graphite-glass.svg"));
  const home = read("frontend/src/pages/customer/CustomerHomePage.tsx");
  assert.match(home, /preserveAspectRatio="xMaxYMid meet" viewBox="0 0 1983 793"/);
  assert.match(store, /aspect-ratio: 1983 \/ 793;/);
  assert.ok(retail.includes("ys-dark-midnight-velvet.svg"));
  assert.ok(retail.includes("ys-dark-graphite-glass.svg"));
  assert.ok(app.includes("@/styles/theme-storefront-contrast.css"));
  for (const contents of [store, component, retail]) {
    assert.ok(
      !contents.includes("kpi-card-frosted-ribbon.webp"),
      "Old Light Mode texture referenced in Dark Mode theme"
    );
    assert.ok(
      !contents.includes(".about-experience"),
      "Protected About CSS selector present in a dark theme"
    );
  }
});

test("new image textures are separate from existing Light Mode assets", () => {
  for (const asset of [
    "frontend/public/textures/ys-dark-midnight-velvet.svg",
    "frontend/public/textures/ys-dark-graphite-glass.svg",
    "frontend/public/textures/ys-dark-indigo-silk.svg"
  ]) {
    const contents = read(asset);
    assert.ok(contents.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(contents.includes('preserveAspectRatio="xMidYMid slice"'));
    assert.ok(contents.trimEnd().endsWith("</svg>"));
    assert.ok(!contents.includes("kpi-card-frosted-ribbon.webp"));
  }
});

test("About is excluded before theme is applied and original media stays in place", () => {
  const ctx = read("frontend/src/context/AppearanceContext.tsx");
  const entry = read("frontend/index.html");
  const about = read("frontend/src/pages/customer/AboutExperiencePage.tsx");

  assert.ok(ctx.includes('pathname === "/about"'));
  assert.ok(entry.includes('path === "/about"'));
  assert.ok(about.includes("storyTheme"));
});

test("dark storefront outlines and remaining light panels are explicitly addressed", () => {
  const contrast = read("frontend/src/styles/theme-storefront-contrast.css");
  const retail = read("frontend/src/styles/theme-retail.css");

  for (const selector of [
    ".customer-global-search__popup",
    ".customer-account-empty",
    ".customer-account-auth-methods > span",
    ".customer-account-password-change-current",
    ".customer-auth-page--recovery",
    ".home-next-step h2"
  ]) {
    assert.ok(contrast.includes(selector), `Dark styling missing: ${selector}`);
  }
  assert.match(contrast, /--store-outline-panel:\s*#64758f/);
  assert.match(contrast, /background-size:\s*min\(1600px, 100%\) auto/);
  assert.match(retail, /background-size:\s*min\(1600px, 100%\) auto !important/);
  assert.doesNotMatch(contrast, /\.about-experience|\.discover-story|\.story-welcome/);
});

test("staff Support conversation surfaces preserve dark-mode contrast", () => {
  const retail = read("frontend/src/styles/theme-retail.css");
  const inbox = read("frontend/src/pages/CustomerSupportInboxPage.tsx");

  for (const target of [
    "ys-support-inbox",
    "ys-support-ticket",
    "ys-support-thread",
    "ys-support-automated-email",
    "ys-support-customer-message",
    "ys-support-system-event",
    "ys-support-fact",
    "ys-support-reply-form",
    "ys-support-reply-trigger"
  ]) {
    assert.ok(inbox.includes(target), `Missing scoped Support component: ${target}`);
    assert.ok(retail.includes(`.${target}`), `Missing Support dark theme target: ${target}`);
  }
  assert.match(inbox, /data-active=\{active\}/);
  assert.match(retail, /:root\.dark \.app-shell-ambient \.ys-support-inbox/);
  assert.match(retail, /\.ys-support-ticket\[data-active="true"\]/);

  for (const [name, foreground, background] of [
    ["selected ticket", "#f3f6ff", "#354665"],
    ["automated email", "#eef3ff", "#293854"],
    ["email metadata", "#d2c6ff", "#293854"],
    ["customer message", "#ecf1ff", "#22334c"],
    ["system event", "#d7e2f5", "#2a3b56"]
  ]) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${name} text does not meet AA contrast`
    );
  }
});

test("forecast detail chart has an unobstructed dark grid surface", () => {
  const forecast = read("frontend/src/pages/ForecastPage.tsx");
  const retail = read("frontend/src/styles/theme-retail.css");

  assert.match(forecast, /className="ys-forecast-chart min-h-\[20rem\] flex-1"/);
  assert.match(
    retail,
    /:root\.dark \.app-shell-ambient \.ys-forecast-chart \{\s*background-color: #1c2b43;\s*background-image: none;/
  );
  assert.match(
    retail,
    /\.ys-forecast-chart \.recharts-cartesian-grid line \{\s*stroke: #526580;/
  );
  assert.ok(
    contrastRatio("#526580", "#1c2b43") >= 2.2,
    "Forecast grid should remain visible without competing with the plotted series"
  );
});

test("forecast selected rows, monthly preview and user management hovers stay readable in dark mode", () => {
  const forecast = read("frontend/src/components/reports/RestockForecastPanel.tsx");
  const users = read("frontend/src/pages/UserManagementPage.tsx");
  const retail = read("frontend/src/styles/theme-retail.css");

  assert.match(forecast, /ys-restock-product-row/);
  assert.match(forecast, /data-selected=\{selectedRow\}/);
  assert.match(forecast, /ys-restock-month-preview/);
  assert.match(forecast, /ys-restock-month-preview-note/);
  assert.match(users, /ys-user-management-tabs/);
  assert.match(users, /ys-user-management-tab/);
  assert.match(users, /data-active=\{activeTab === "store"\}/);

  for (const selector of [
    ".ys-restock-product-row[data-selected=\"true\"]",
    ".ys-restock-product-row[data-selected=\"true\"]:hover",
    ".ys-restock-month-preview",
    ".ys-restock-month-preview-title",
    ".ys-restock-month-preview-note",
    ".ys-user-management-tabs .ys-user-management-tab:hover",
    ".ys-user-management-tabs .ys-user-management-tab[data-active=\"true\"]"
  ]) {
    assert.ok(retail.includes(selector), `Missing scoped dark contrast styling: ${selector}`);
  }

  for (const [label, fg, bg] of [
    ["selected forecast name", "#f2f5ff", "#354563"],
    ["selected forecast subtitle", "#ccd7eb", "#354563"],
    ["hovered forecast name", "#f2f5ff", "#3c4d70"],
    ["restock preview label", "#cdc4ff", "#273650"],
    ["restock preview title", "#f3f5ff", "#273650"],
    ["restock preview note", "#d2dff2", "#273650"],
    ["user management hovered tab", "#f3f5ff", "#30415e"],
    ["user management active tab", "#e7e0ff", "#39365e"]
  ]) {
    assert.ok(contrastRatio(fg, bg) >= 4.5, `${label} has insufficient dark contrast`);
  }
});

test("customer address labels and empty-session heading keep readable dark contrast", () => {
  const dark = read("frontend/src/styles/theme-storefront-contrast.css");
  const premium = read("frontend/src/styles/customer-account-premium.css");
  const layout = read("frontend/src/pages/customer/CustomerAccountPage.tsx");

  assert.match(premium, /#profile-panel \.customer-account-address-form label > span/);
  assert.match(layout, /className="customer-account-address-form"/);
  assert.match(layout, /className="customer-account-session-empty"/);
  assert.match(dark, /Sprint 11 customer profile: late premium light-theme ID selectors/);
  assert.match(dark, /:root\.dark\[data-appearance-scope="storefront"\]/);
  assert.match(dark, /\.customer-account-address-form/);
  assert.match(dark, /label > span small/);
  assert.match(dark, /\.customer-account-address-heading p/);
  assert.match(dark, /\.customer-account-session-empty strong/);
  assert.match(dark, /\.customer-account-session-empty span/);

  for (const [label, ink, surface] of [
    ["delivery form labels", "#d1dcef", "#24334a"],
    ["optional address label", "#d1dcef", "#24334a"],
    ["address help", "#bfcde2", "#24334a"],
    ["no-other-session heading", "#eef3ff", "#24334a"],
    ["no-other-session body", "#cbd7e9", "#24334a"]
  ]) {
    assert.ok(
      contrastRatio(ink, surface) >= 4.5,
      `${label} lacks WCAG AA dark contrast: ${contrastRatio(ink, surface).toFixed(2)}:1`
    );
  }
});

test("restock recommendation action card keeps all warning and status text readable", () => {
  const forecast = read("frontend/src/components/reports/RestockForecastPanel.tsx");
  const retail = read("frontend/src/styles/theme-retail.css");

  assert.match(forecast, /className=\{`ys-restock-recommendation /);
  assert.match(forecast, /data-tone=\{tone\}/);
  for (const part of ["label", "title", "body", "meta"]) {
    assert.ok(
      forecast.includes(`ys-restock-recommendation-${part}`),
      `Missing restock action ${part} class`
    );
    assert.ok(
      retail.includes(`.ys-restock-recommendation-${part}`),
      `Missing scoped dark restock action ${part} color`
    );
  }
  for (const tone of ["amber", "emerald", "indigo"]) {
    assert.ok(
      retail.includes(`.ys-restock-recommendation[data-tone="${tone}"]`),
      `Missing dark recommendation treatment for ${tone}`
    );
  }

  for (const [tone, background, foregrounds] of [
    ["amber", "#3d3123", ["#ffdc9a", "#fff1d7", "#ebdcc3", "#f2d8ad"]],
    ["emerald", "#233b38", ["#a8eacb", "#e7fff2", "#c8e8da", "#b8dfcf"]],
    ["indigo", "#293651", ["#cbbfff", "#f1edff", "#d0dbf3", "#c1ccec"]]
  ]) {
    for (const ink of foregrounds) {
      assert.ok(
        contrastRatio(ink, background) >= 4.5,
        `${tone} restock action text fails WCAG AA contrast`
      );
    }
  }
});
