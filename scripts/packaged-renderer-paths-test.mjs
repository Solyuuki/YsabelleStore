import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Vite emits relative asset URLs for Electron file loading", async () => {
  const viteConfig = await readFile(join(repoRoot, "frontend", "vite.config.ts"), "utf8");
  assert.match(viteConfig, /base:\s*["']\.\/["']/);
});

test("packaged customer router treats file index.html as home", async () => {
  const customerApp = await readFile(
    join(repoRoot, "frontend", "src", "app", "CustomerApp.tsx"),
    "utf8"
  );

  assert.match(customerApp, /window\.location\.protocol === ["']file:["']/);
  assert.match(customerApp, /rawPathname\.endsWith\(["']\/index\.html["']\)/);
});
