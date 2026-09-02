import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const statCardUrl = new URL("../../frontend/src/components/shared/StatCard.tsx", import.meta.url);

test("dashboard stat icons use the retailer brand palette instead of the legacy slate tile", () => {
  const statCard = readFileSync(statCardUrl, "utf8");

  assert.match(statCard, /bg-gradient-to-br/);
  assert.match(statCard, /from-blue-500/);
  assert.match(statCard, /via-violet-500/);
  assert.match(statCard, /to-pink-500/);
  assert.match(statCard, /text-white/);
  assert.doesNotMatch(statCard, /bg-slate-100 text-slate-700/);
});
