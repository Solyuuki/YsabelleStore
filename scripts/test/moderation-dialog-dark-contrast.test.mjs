import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const page = read("frontend/src/pages/UserManagementPage.tsx");
const css = read("frontend/src/styles/theme-retail.css");
const dialog = page.split("function ModerationDialog(")[1]?.split("function managementTabClass(")[0] ?? "";

function luminance(hex) {
  const channels = (hex.match(/[0-9a-f]{2}/gi) ?? []).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

test("Moderation popup scopes dark-mode text, placeholder and button styling", () => {
  for (const className of [
    "ys-moderation-dialog",
    "ys-moderation-title",
    "ys-moderation-description",
    "ys-moderation-reason",
    "ys-moderation-reason-input",
    "ys-moderation-footer",
    "ys-moderation-cancel",
    "ys-moderation-confirm"
  ]) {
    assert.ok(dialog.includes(className), `Dialog missing ${className}`);
    assert.ok(css.includes(`.ys-moderation-${className.replace("ys-moderation-", "")}`), `Theme missing ${className}`);
  }
  assert.ok(css.includes(':root.dark [role="dialog"].ys-moderation-dialog'));
  assert.ok(css.includes('.ys-moderation-reason-input::placeholder'));
  assert.ok(css.includes('.ys-moderation-cancel:hover:not(:disabled)'));
  assert.ok(css.includes('.ys-moderation-confirm:disabled'));
});

test("Moderation dialog retains safe cancellation and reason validation", () => {
  assert.ok(dialog.includes("onClick={() => onOpenChange(false)}"));
  assert.ok(dialog.includes("disabled={saving}"));
  assert.ok(dialog.includes("disabled={saving || reason.trim().length < 3}"));
  assert.ok(dialog.includes("onClick={onSubmit}"));
  assert.ok(dialog.includes("onReasonChange(event.target.value)"));
  assert.ok(dialog.includes('maxLength={500}'));
});

test("Dark moderation copy and button states have WCAG AA text contrast", () => {
  for (const [name, foreground, background] of [
    ["Reason label", "#e8eefb", "#1b283e"],
    ["Description", "#cbd7eb", "#1b283e"],
    ["Textarea content", "#f3f6ff", "#121e32"],
    ["Placeholder", "#b8c8e1", "#121e32"],
    ["Cancel", "#eef3ff", "#31445f"],
    ["Confirm", "#ffffff", "#4e43d1"],
    ["Disabled confirm", "#d4dcf4", "#3e4163"]
  ]) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${name} contrast below WCAG AA: ${contrastRatio(foreground, background).toFixed(2)}:1`
    );
  }
});
