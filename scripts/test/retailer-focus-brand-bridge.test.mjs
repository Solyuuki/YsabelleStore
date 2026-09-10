import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("retailer legacy focus borders render with the Ysabelle indigo focus color", () => {
  const theme = read("frontend/src/styles/retailer-brand.css");

  assert.match(theme, /focus-within:border-emerald-400/);
  assert.match(theme, /focus-within:border-green-400/);
  assert.match(theme, /focus:border-emerald-400/);
  assert.match(theme, /focus:border-green-400/);
  assert.match(
    theme,
    /focus-within:border-emerald-400[\s\S]*?border-color:\s*var\(--ys-indigo\)\s*!important/
  );
});
