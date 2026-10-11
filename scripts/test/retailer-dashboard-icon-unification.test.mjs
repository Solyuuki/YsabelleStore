import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const statCardUrl = new URL("../../frontend/src/components/shared/StatCard.tsx", import.meta.url);

test("dashboard stat icons use the retailer brand palette instead of the legacy slate tile", () => {
  const statCard = readFileSync(statCardUrl, "utf8");

  assert.match(statCard, /bg-gradient-to-br/);
  assert.match(statCard, /from-sky-500 via-blue-500 to-indigo-500/);
  assert.match(statCard, /from-violet-500 via-purple-500 to-fuchsia-500/);
  assert.match(statCard, /from-emerald-400 via-emerald-500 to-teal-500/);
  assert.match(statCard, /from-amber-400 via-orange-400 to-orange-500/);
  assert.match(statCard, /from-rose-400 via-pink-500 to-rose-500/);
  assert.match(statCard, /text-white/);
  assert.doesNotMatch(statCard, /bg-slate-100 text-slate-700/);
});
