import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

function luminance(hex) {
  const channels = hex.slice(1).match(/../g);
  assert.ok(channels && channels.length === 3, "Invalid hexadecimal color: " + hex);
  const linear = channels.map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a, b) {
  const top = Math.max(luminance(a), luminance(b));
  const bottom = Math.min(luminance(a), luminance(b));
  return (top + 0.05) / (bottom + 0.05);
}

test("Reports Add product has scoped dark portal tokens and readable action states", () => {
  const panel = read("frontend/src/components/reports/RestockPlanningPanel.tsx");
  const theme = read("frontend/src/styles/theme-retail.css");

  assert.ok(panel.includes('<DialogContent className="ys-restock-product-picker max-w-[820px]">'));
  assert.ok(panel.includes('className="ys-restock-product-picker__search-input"'));
  assert.equal(
    panel.split('className="ys-restock-product-picker__secondary-action"').length - 1,
    2,
    "Search and Done must share the scoped secondary-action treatment"
  );
  assert.equal(
    panel.split("ys-restock-product-picker__empty rounded-lg").length - 1,
    2,
    "Both initial and no-matches empty states must be legible"
  );
  assert.ok(
    theme.includes(
      ':root.dark[data-appearance-scope="retail"] [role="dialog"].ys-restock-product-picker'
    )
  );
  for (const selector of [
    ".ys-restock-product-picker__search-input::placeholder",
    ".ys-restock-product-picker__secondary-action:hover:not(:disabled)",
    ".ys-restock-product-picker__secondary-action:disabled",
    ".ys-restock-product-picker__empty",
    ".ys-restock-product-picker__results"
  ]) {
    assert.ok(theme.includes(selector), "Missing dedicated dark style: " + selector);
  }
  assert.ok(theme.includes("button:disabled {\n  opacity: 0.86;"));
  assert.ok(theme.includes("outline: 2px solid #b7abff;"));
});

test("Reports picker dark token pairs meet WCAG AA normal-text contrast", () => {
  const theme = read("frontend/src/styles/theme-retail.css");
  const pairs = [
    ["dialog copy", "#f2f5ff", "#1b283e"],
    ["input text", "#f2f5ff", "#17263e"],
    ["input placeholder", "#bfcee4", "#17263e"],
    ["enabled action", "#f4f6ff", "#2c3d57"],
    ["hovered action", "#ffffff", "#3a4b6a"],
    ["disabled action", "#dce5f3", "#29374e"],
    ["empty state", "#dbe5f5", "#22324a"]
  ];
  for (const [label, textColor, background] of pairs) {
    assert.ok(theme.includes("color: " + textColor + ";"), "Missing " + label + " foreground");
    assert.ok(theme.includes(background), "Missing " + label + " background");
    assert.ok(contrast(textColor, background) >= 4.5, label + " below WCAG AA");
  }
});

test("Deliveries uses a plain-language label without changing active filtering", () => {
  const page = read("frontend/src/pages/DeliveriesPage.tsx");
  const service = read("backend/src/services/deliveryService.ts");

  assert.ok(page.replace(/\s+/g, " ").includes('? "Needs action" : nextView === "history"'));
  assert.ok(page.includes('label="Needs action" value={meta.counts.active}'));
  assert.ok(page.includes('"Deliveries to handle"'));
  assert.ok(page.includes("Orders to prepare, deliver, or collect payment for."));
  assert.ok(page.includes("setView(nextView);"));
  assert.ok(service.includes("deliveryViewWhere(query.view)"));
  assert.ok(!page.includes('"Active queue"'));
});
