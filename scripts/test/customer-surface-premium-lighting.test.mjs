import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("storefront home and shop use scoped premium ambient lighting", () => {
  const main = read("frontend/src/main.tsx");
  const lighting = read("frontend/src/styles/customer-surface-lighting.css");

  assert.match(main, /@\/styles\/customer-surface-lighting\.css/);
  assert.match(lighting, /\.customer-home/);
  assert.match(lighting, /\.customer-shop-page/);
  assert.match(lighting, /#fcfdff/i);
  assert.match(lighting, /radial-gradient/);
  assert.match(lighting, /@keyframes customer-surface-ambient-drift/);
  assert.match(lighting, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(lighting, /\.customer-page\s*\{/);
  assert.doesNotMatch(lighting, /body\s*\{/);
});

test("customer navigation uses About instead of About Us", () => {
  const header = read("frontend/src/components/customer/CustomerHeader.tsx");

  assert.match(header, /label: "About"/);
  assert.doesNotMatch(header, /About Us/);
});
