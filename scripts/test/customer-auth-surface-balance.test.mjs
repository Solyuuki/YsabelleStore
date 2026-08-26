import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");
const ruleBody = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `${selector} rule must exist`);
  return match[1];
};

test("customer auth uses independent content-hugging brand and form surfaces", () => {
  const css = read("frontend/src/styles/customer-auth-phase3.css");
  const stage = ruleBody(css, ".customer-auth-stage");
  const brand = ruleBody(css, ".customer-auth-stage__brand");
  const panel = ruleBody(css, ".customer-auth-stage__panel");

  assert.match(stage, /align-items:\s*start;/);
  assert.match(stage, /gap:/);
  assert.match(stage, /background:\s*transparent;/);
  assert.doesNotMatch(stage, /overflow:\s*hidden;/);
  assert.doesNotMatch(stage, /box-shadow:/);

  assert.match(brand, /border-radius:/);
  assert.match(brand, /box-shadow:/);

  assert.match(panel, /align-self:\s*start;/);
  assert.match(panel, /height:\s*fit-content;/);
  assert.match(panel, /border:/);
  assert.match(panel, /border-radius:/);
  assert.match(panel, /box-shadow:/);
  assert.match(panel, /background:\s*rgb\(255 255 255 \/ 94%\);/);
});
